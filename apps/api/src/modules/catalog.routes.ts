import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { Prisma } from '@prisma/client';
import { pincodeSchema, ymdSchema, type CatalogHome, type CatalogItem, type LocateResult } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { param, parse, q } from '../lib/http';
import { AppError, badRequest, notFound } from '../lib/errors';
import { itemInclude, toBanner, toCategory, toItem } from '../lib/serializers';
import { catalogDate, slotOptions } from '../services/slots';
import { remainingByItem } from '../services/stock';
import { reverseGeocode } from '../services/geocode';

/** Public catalog. Customers browse without logging in; the area comes from their pincode. */
export const catalogRouter = Router();

// The public catalog is the same for every shopper in an area; a short browser cache makes
// back/forward navigation instant without serving stale stock for long.
catalogRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=60');
  next();
});

async function activeArea(areaId: string | undefined) {
  if (!areaId) throw badRequest('areaId is required');
  const area = await prisma.area.findFirst({ where: { id: areaId, isActive: true } });
  if (!area) throw notFound('Area');
  return area;
}

async function withStock(items: Prisma.ItemGetPayload<{ include: typeof itemInclude }>[], areaId: string, date: string): Promise<CatalogItem[]> {
  const remaining = await remainingByItem(areaId, date, items.map((i) => i.id));
  return items
    .map((i) => ({ ...toItem(i, { activeVariantsOnly: true }), remainingQty: remaining.get(i.id) ?? 0 }))
    .filter((i) => i.variants.length > 0);
}

catalogRouter.get('/serviceability', async (req, res) => {
  const pincode = parse(pincodeSchema, q(req, 'pincode'));
  const row = await prisma.areaPincode.findUnique({
    where: { pincode },
    include: { area: { select: { id: true, code: true, name: true, city: true, isActive: true } } },
  });
  if (!row || !row.area.isActive) return res.json({ serviceable: false, area: null });
  const { isActive: _ignored, ...area } = row.area;
  res.json({ serviceable: true, area });
});

// GPS position -> pincode -> delivery area. Rate limited because it calls a free public geocoder.
const locateLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
function coord(req: Request, name: string, min: number, max: number) {
  const raw = q(req, name);
  const n = raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`Invalid ${name}`);
  return n;
}
catalogRouter.get('/locate', locateLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const lat = coord(req, 'lat', -90, 90);
  const lng = coord(req, 'lng', -180, 180);
  let found;
  try {
    found = await reverseGeocode(lat, lng);
  } catch {
    throw new AppError(502, 'GEOCODER_UNAVAILABLE', 'Could not look up your location right now. Please enter your pincode instead.');
  }
  let area = null;
  if (found.pincode) {
    const row = await prisma.areaPincode.findUnique({
      where: { pincode: found.pincode },
      include: { area: { select: { id: true, code: true, name: true, city: true, isActive: true } } },
    });
    if (row?.area.isActive) area = { id: row.area.id, code: row.area.code, name: row.area.name, city: row.area.city };
  }
  const body: LocateResult = { lat, lng, ...found, serviceable: !!area, area };
  res.json(body);
});

catalogRouter.get('/home', async (req, res) => {
  const area = await activeArea(q(req, 'areaId'));
  const { date, nextSlot } = await catalogDate(area.id);
  const [banners, categories, items] = await Promise.all([
    prisma.banner.findMany({ where: { areaId: area.id, isActive: true }, orderBy: { sort: 'asc' } }),
    prisma.category.findMany({ where: { areaId: area.id, isActive: true }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    prisma.item.findMany({ relationLoadStrategy: 'join', where: { areaId: area.id, isActive: true }, include: itemInclude, orderBy: { updatedAt: 'desc' }, take: 40 }),
  ]);
  const stocked = await withStock(items, area.id, date);
  const body: CatalogHome = {
    area: {
      id: area.id,
      code: area.code,
      name: area.name,
      city: area.city,
      minOrderPaise: area.minOrderPaise,
      deliveryFeePaise: area.deliveryFeePaise,
      freeDeliveryAbovePaise: area.freeDeliveryAbovePaise,
    },
    deliveryDate: date,
    nextSlot,
    banners: banners.map(toBanner),
    categories: categories.map(toCategory),
    freshPicks: stocked.filter((i) => i.remainingQty > 0).slice(0, 12),
  };
  res.json(body);
});

catalogRouter.get('/items', async (req, res) => {
  const area = await activeArea(q(req, 'areaId'));
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : (await catalogDate(area.id)).date;
  const search = q(req, 'q');
  const items = await prisma.item.findMany({
    relationLoadStrategy: 'join',
    where: {
      areaId: area.id,
      isActive: true,
      category: { isActive: true },
      ...(q(req, 'categoryId') ? { categoryId: q(req, 'categoryId') } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    },
    include: itemInclude,
    orderBy: { name: 'asc' },
  });
  const list = await withStock(items, area.id, date);
  // In-stock items first, sold out at the bottom.
  list.sort((a, b) => Number(b.remainingQty > 0) - Number(a.remainingQty > 0));
  res.json({ date, items: list });
});

catalogRouter.get('/items/:id', async (req, res) => {
  const item = await prisma.item.findFirst({ relationLoadStrategy: 'join', where: { id: param(req, 'id'), isActive: true }, include: itemInclude });
  if (!item) throw notFound('Item');
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : (await catalogDate(item.areaId)).date;
  const [withQty] = await withStock([item], item.areaId, date);
  if (!withQty) throw notFound('Item');
  res.json({ date, item: withQty });
});

catalogRouter.get('/slots', async (req, res) => {
  const area = await activeArea(q(req, 'areaId'));
  res.json(await slotOptions(area.id, 3));
});
