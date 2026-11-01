import { Router } from 'express';
import {
  bannerUpsertSchema,
  categoryUpsertSchema,
  couponUpsertSchema,
  itemUpsertSchema,
  priceBoardSchema,
  slotUpsertSchema,
  stockBoardSchema,
  stockCopySchema,
  todayIST,
  wastageSchema,
  ymdSchema,
  ymdToDate,
  type StockRow,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, pageParams, param, parse, q } from '../lib/http';
import { badRequest, notFound } from '../lib/errors';
import { audit } from '../lib/audit';
import { itemInclude, toBanner, toCategory, toCoupon, toItem, toSlot } from '../lib/serializers';
import { assertSameArea, authenticate, me, requirePermission, scopeArea } from '../middleware/auth';

/** Area configuration: catalog, prices, stock, slots, coupons, banners, feedback. */
export const manageRouter = Router();
manageRouter.use(authenticate);

// ---------------------------------------------------------------- categories

manageRouter.get('/categories', requirePermission('managePriceStock'), async (req, res) => {
  const rows = await prisma.category.findMany({
    where: { areaId: scopeArea(req) },
    include: { _count: { select: { items: true } } },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  });
  res.json(rows.map(toCategory));
});

manageRouter.post('/categories', requirePermission('manageCatalog'), async (req, res) => {
  const data = body(req, categoryUpsertSchema);
  const c = await prisma.category.create({ data: { ...data, areaId: scopeArea(req) } });
  res.status(201).json(toCategory(c));
});

manageRouter.patch('/categories/:id', requirePermission('manageCatalog'), async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Category');
  assertSameArea(req, existing.areaId);
  const c = await prisma.category.update({ where: { id: existing.id }, data: body(req, categoryUpsertSchema.partial()) });
  res.json(toCategory(c));
});

// ---------------------------------------------------------------- items

manageRouter.get('/items', requirePermission('managePriceStock'), async (req, res) => {
  const search = q(req, 'q');
  const items = await prisma.item.findMany({
    where: {
      areaId: scopeArea(req),
      ...(q(req, 'categoryId') ? { categoryId: q(req, 'categoryId') } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { ...itemInclude, category: { select: { name: true } } },
    orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
  });
  res.json(items.map((i) => ({ ...toItem(i), categoryName: i.category.name })));
});

manageRouter.get('/items/:id', requirePermission('managePriceStock'), async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: param(req, 'id') }, include: itemInclude });
  if (!item) throw notFound('Item');
  assertSameArea(req, item.areaId);
  res.json(toItem(item));
});

async function assertCategoryInArea(categoryId: string, areaId: string) {
  const cat = await prisma.category.findFirst({ where: { id: categoryId, areaId } });
  if (!cat) throw badRequest('Category does not belong to this area');
}

manageRouter.post('/items', requirePermission('manageCatalog'), async (req, res) => {
  const areaId = scopeArea(req);
  const { variants, ...data } = body(req, itemUpsertSchema);
  await assertCategoryInArea(data.categoryId, areaId);
  const item = await prisma.item.create({
    data: {
      ...data,
      areaId,
      variants: { create: variants.map(({ id: _id, ...v }, sort) => ({ ...v, sort })) },
    },
    include: itemInclude,
  });
  await audit({ actorId: me(req).sub, areaId, action: 'item.create', entity: 'Item', entityId: item.id });
  res.status(201).json(toItem(item));
});

manageRouter.put('/items/:id', requirePermission('manageCatalog'), async (req, res) => {
  const id = param(req, 'id');
  const existing = await prisma.item.findUnique({ where: { id }, include: itemInclude });
  if (!existing) throw notFound('Item');
  assertSameArea(req, existing.areaId);
  const { variants, ...data } = body(req, itemUpsertSchema);
  await assertCategoryInArea(data.categoryId, existing.areaId);

  const item = await prisma.$transaction(async (tx) => {
    await tx.item.update({ where: { id }, data });
    const keep = new Set(variants.map((v) => v.id).filter(Boolean));
    // Removed pack sizes are deactivated, not deleted, so past orders and carts stay intact.
    await tx.itemVariant.updateMany({ where: { itemId: id, id: { notIn: [...keep] as string[] } }, data: { isActive: false } });
    for (const [sort, { id: variantId, ...v }] of variants.entries()) {
      if (variantId && existing.variants.some((x) => x.id === variantId)) {
        await tx.itemVariant.update({ where: { id: variantId }, data: { ...v, sort } });
      } else {
        await tx.itemVariant.create({ data: { ...v, sort, itemId: id } });
      }
    }
    return tx.item.findUniqueOrThrow({ where: { id }, include: itemInclude });
  });
  await audit({ actorId: me(req).sub, areaId: existing.areaId, action: 'item.update', entity: 'Item', entityId: id });
  res.json(toItem(item));
});

manageRouter.patch('/items/:id/active', requirePermission('manageCatalog'), async (req, res) => {
  const existing = await prisma.item.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Item');
  assertSameArea(req, existing.areaId);
  const isActive = Boolean(req.body?.isActive);
  const item = await prisma.item.update({ where: { id: existing.id }, data: { isActive }, include: itemInclude });
  res.json(toItem(item));
});

// ---------------------------------------------------------------- daily prices

manageRouter.put('/prices', requirePermission('managePriceStock'), async (req, res) => {
  const areaId = scopeArea(req);
  const { rows } = body(req, priceBoardSchema);
  const variants = await prisma.itemVariant.findMany({ where: { id: { in: rows.map((r) => r.variantId) } }, include: { item: true } });
  if (variants.some((v) => v.item.areaId !== areaId) || variants.length !== rows.length) throw badRequest('Unknown pack size in price list');
  for (const r of rows) {
    if (r.mrpPaise < r.pricePaise) throw badRequest('MRP cannot be lower than the selling price');
  }
  await prisma.$transaction(
    rows.map((r) =>
      prisma.itemVariant.update({ where: { id: r.variantId }, data: { pricePaise: r.pricePaise, mrpPaise: r.mrpPaise, isActive: r.isActive } }),
    ),
  );
  await audit({ actorId: me(req).sub, areaId, action: 'prices.update', entity: 'ItemVariant', data: { count: rows.length } });
  res.json({ ok: true, updated: rows.length });
});

// ---------------------------------------------------------------- daily stock

manageRouter.get('/stock', requirePermission('managePriceStock'), async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const [items, rows] = await Promise.all([
    prisma.item.findMany({
      where: { areaId, isActive: true },
      include: { category: { select: { name: true, sort: true } } },
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    }),
    prisma.dailyStock.findMany({ where: { areaId, date: ymdToDate(date) } }),
  ]);
  const byItem = new Map(rows.map((r) => [r.itemId, r]));
  const out: StockRow[] = items.map((i) => {
    const r = byItem.get(i.id);
    return {
      itemId: i.id,
      name: i.name,
      unitType: i.unitType,
      categoryName: i.category.name,
      availableQty: r?.availableQty ?? 0,
      reservedQty: r?.reservedQty ?? 0,
      remainingQty: r ? Math.max(0, r.availableQty - r.reservedQty) : 0,
      hasRow: !!r,
    };
  });
  res.json({ date, rows: out });
});

manageRouter.put('/stock', requirePermission('managePriceStock'), async (req, res) => {
  const areaId = scopeArea(req);
  const { date, rows } = body(req, stockBoardSchema);
  const d = ymdToDate(date);
  const items = await prisma.item.findMany({ where: { id: { in: rows.map((r) => r.itemId) }, areaId }, select: { id: true, name: true } });
  if (items.length !== rows.length) throw badRequest('Unknown item in stock list');
  const names = new Map(items.map((i) => [i.id, i.name]));

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const current = await tx.dailyStock.findUnique({ where: { itemId_date: { itemId: r.itemId, date: d } } });
      if (current && r.availableQty < current.reservedQty) {
        throw badRequest(`${names.get(r.itemId)}: ${current.reservedQty} is already booked by customers; stock cannot go below that`);
      }
      await tx.dailyStock.upsert({
        where: { itemId_date: { itemId: r.itemId, date: d } },
        update: { availableQty: r.availableQty },
        create: { areaId, itemId: r.itemId, date: d, availableQty: r.availableQty },
      });
      const diff = r.availableQty - (current?.availableQty ?? 0);
      if (diff !== 0) {
        await tx.stockMovement.create({
          data: { areaId, itemId: r.itemId, type: 'ADJUST', qty: diff, refType: 'DailyStock', refId: date, actorId: me(req).sub },
        });
      }
    }
  });
  res.json({ ok: true });
});

manageRouter.post('/stock/copy', requirePermission('managePriceStock'), async (req, res) => {
  const areaId = scopeArea(req);
  const { fromDate, toDate } = body(req, stockCopySchema);
  const from = await prisma.dailyStock.findMany({ where: { areaId, date: ymdToDate(fromDate) } });
  const existing = new Set(
    (await prisma.dailyStock.findMany({ where: { areaId, date: ymdToDate(toDate) }, select: { itemId: true } })).map((r) => r.itemId),
  );
  const toCreate = from.filter((r) => !existing.has(r.itemId));
  await prisma.dailyStock.createMany({
    data: toCreate.map((r) => ({ areaId, itemId: r.itemId, date: ymdToDate(toDate), availableQty: r.availableQty })),
  });
  res.json({ ok: true, copied: toCreate.length, skipped: from.length - toCreate.length });
});

manageRouter.post('/stock/wastage', requirePermission('managePriceStock'), async (req, res) => {
  const areaId = scopeArea(req);
  const { itemId, qty, note } = body(req, wastageSchema);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const d = ymdToDate(date);
  await prisma.$transaction(async (tx) => {
    const row = await tx.dailyStock.findFirst({ where: { itemId, date: d, areaId } });
    if (row) {
      await tx.dailyStock.update({ where: { id: row.id }, data: { availableQty: Math.max(row.reservedQty, row.availableQty - qty) } });
    }
    await tx.stockMovement.create({ data: { areaId, itemId, type: 'WASTAGE', qty: -qty, note, actorId: me(req).sub } });
  });
  res.json({ ok: true });
});

manageRouter.get('/stock/movements', requirePermission('managePriceStock'), async (req, res) => {
  const { skip, take, page, pageSize } = pageParams(req);
  const where = { areaId: scopeArea(req) };
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({ where, include: { item: { select: { name: true, unitType: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.stockMovement.count({ where }),
  ]);
  res.json({
    data: rows.map((r) => ({ id: r.id, itemName: r.item.name, unitType: r.item.unitType, type: r.type, qty: r.qty, note: r.note, refType: r.refType, createdAt: r.createdAt })),
    total,
    page,
    pageSize,
  });
});

// ---------------------------------------------------------------- slots

manageRouter.get('/slots', requirePermission('managePriceStock'), async (req, res) => {
  const rows = await prisma.deliverySlot.findMany({ where: { areaId: scopeArea(req) }, orderBy: [{ sort: 'asc' }, { startTime: 'asc' }] });
  res.json(rows.map(toSlot));
});

manageRouter.post('/slots', requirePermission('manageSlots'), async (req, res) => {
  const data = body(req, slotUpsertSchema);
  if (data.endTime <= data.startTime) throw badRequest('End time must be after start time');
  const s = await prisma.deliverySlot.create({ data: { ...data, areaId: scopeArea(req) } });
  res.status(201).json(toSlot(s));
});

manageRouter.put('/slots/:id', requirePermission('manageSlots'), async (req, res) => {
  const existing = await prisma.deliverySlot.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Slot');
  assertSameArea(req, existing.areaId);
  const data = body(req, slotUpsertSchema);
  if (data.endTime <= data.startTime) throw badRequest('End time must be after start time');
  const s = await prisma.deliverySlot.update({ where: { id: existing.id }, data });
  res.json(toSlot(s));
});

// ---------------------------------------------------------------- coupons

manageRouter.get('/coupons', requirePermission('manageCoupons'), async (req, res) => {
  const rows = await prisma.coupon.findMany({ where: { areaId: scopeArea(req) }, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(toCoupon));
});

function couponData(input: ReturnType<typeof couponUpsertSchema.parse>) {
  if (input.type === 'PERCENT' && input.value > 100) throw badRequest('Percent discount cannot exceed 100');
  if (input.validTo < input.validFrom) throw badRequest('Valid-to date must be after valid-from');
  return { ...input, validFrom: ymdToDate(input.validFrom), validTo: ymdToDate(input.validTo) };
}

manageRouter.post('/coupons', requirePermission('manageCoupons'), async (req, res) => {
  const c = await prisma.coupon.create({ data: { ...couponData(body(req, couponUpsertSchema)), areaId: scopeArea(req) } });
  res.status(201).json(toCoupon(c));
});

manageRouter.put('/coupons/:id', requirePermission('manageCoupons'), async (req, res) => {
  const existing = await prisma.coupon.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Coupon');
  assertSameArea(req, existing.areaId);
  const c = await prisma.coupon.update({ where: { id: existing.id }, data: couponData(body(req, couponUpsertSchema)) });
  res.json(toCoupon(c));
});

// ---------------------------------------------------------------- banners

manageRouter.get('/banners', requirePermission('manageBanners'), async (req, res) => {
  const rows = await prisma.banner.findMany({ where: { areaId: scopeArea(req) }, orderBy: { sort: 'asc' } });
  res.json(rows.map(toBanner));
});

manageRouter.post('/banners', requirePermission('manageBanners'), async (req, res) => {
  const b = await prisma.banner.create({ data: { ...body(req, bannerUpsertSchema), areaId: scopeArea(req) } });
  res.status(201).json(toBanner(b));
});

manageRouter.put('/banners/:id', requirePermission('manageBanners'), async (req, res) => {
  const existing = await prisma.banner.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Banner');
  assertSameArea(req, existing.areaId);
  const b = await prisma.banner.update({ where: { id: existing.id }, data: body(req, bannerUpsertSchema) });
  res.json(toBanner(b));
});

manageRouter.delete('/banners/:id', requirePermission('manageBanners'), async (req, res) => {
  const existing = await prisma.banner.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Banner');
  assertSameArea(req, existing.areaId);
  await prisma.banner.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- feedback

manageRouter.get('/ratings', requirePermission('viewFeedback'), async (req, res) => {
  const { skip, take, page, pageSize } = pageParams(req);
  const where = { order: { areaId: scopeArea(req) } };
  const [rows, total, avg] = await Promise.all([
    prisma.rating.findMany({ where, include: { order: { select: { orderNo: true, customerName: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.rating.count({ where }),
    prisma.rating.aggregate({ where, _avg: { stars: true } }),
  ]);
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNo: r.order.orderNo,
      stars: r.stars,
      comment: r.comment,
      customerName: r.order.customerName,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    average: avg._avg.stars,
  });
});
