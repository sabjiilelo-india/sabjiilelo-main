import { Router } from 'express';
import {
  RESERVING_ORDER_STATUSES,
  addDays,
  costPaise,
  poCreateSchema,
  poReceiveSchema,
  todayIST,
  ymdSchema,
  ymdToDate,
  type DemandRow,
  type PoStatus,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param, parse, q } from '../lib/http';
import { badRequest, notFound } from '../lib/errors';
import { audit } from '../lib/audit';
import { assertSameArea, authenticate, me, requirePermission, scopeArea } from '../middleware/auth';
import { nextPoNo } from '../services/numbering';
import { notify } from '../services/notifier';
import { poInclude, toPo } from '../services/supply';

/** Buying from vendors: demand planning, purchase orders, goods receipt. */
export const supplyRouter = Router();
supplyRouter.use(authenticate, requirePermission('supply'));

/** Latest quoted rate per vendor and item within the last few days up to `date`. */
async function latestRates(areaId: string, date: string) {
  const rows = await prisma.vendorRate.findMany({
    where: { vendor: { areaId, user: { status: 'ACTIVE' } }, date: { gte: ymdToDate(addDays(date, -3)), lte: ymdToDate(date) } },
    include: { vendor: { select: { businessName: true } } },
    orderBy: { date: 'desc' },
  });
  const seen = new Set<string>();
  const out = new Map<string, { vendorId: string; vendorName: string; ratePaise: number }[]>();
  for (const r of rows) {
    const key = `${r.vendorId}:${r.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = out.get(r.itemId) ?? [];
    list.push({ vendorId: r.vendorId, vendorName: r.vendor.businessName, ratePaise: r.ratePaise });
    out.set(r.itemId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.ratePaise - b.ratePaise);
  return out;
}

supplyRouter.get('/demand', async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : addDays(todayIST(), 1);
  const d = ymdToDate(date);
  const area = await prisma.area.findUniqueOrThrow({ where: { id: areaId } });
  const [orderItems, poItems, rates, items] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { areaId, slotDate: d, channel: { not: 'POS' }, status: { in: [...RESERVING_ORDER_STATUSES] } } },
      select: { itemId: true, baseQty: true, qty: true, packedQty: true },
    }),
    prisma.poItem.findMany({
      where: { po: { areaId, forDate: d, status: { notIn: ['REJECTED'] } } },
      select: { itemId: true, orderedQty: true, acceptedQty: true, receivedQty: true },
    }),
    latestRates(areaId, date),
    prisma.item.findMany({ where: { areaId, isActive: true }, select: { id: true, name: true, unitType: true }, orderBy: { name: 'asc' } }),
  ]);
  const ordered = new Map<string, number>();
  for (const it of orderItems) ordered.set(it.itemId, (ordered.get(it.itemId) ?? 0) + it.baseQty * (it.packedQty ?? it.qty));
  const onPo = new Map<string, number>();
  for (const p of poItems) onPo.set(p.itemId, (onPo.get(p.itemId) ?? 0) + (p.receivedQty ?? p.acceptedQty ?? p.orderedQty));

  const rows: DemandRow[] = items
    .map((i) => {
      const orderedBaseQty = ordered.get(i.id) ?? 0;
      const bufferBaseQty = Math.ceil((orderedBaseQty * area.demandBufferPct) / 100);
      const r = rates.get(i.id) ?? [];
      return {
        itemId: i.id,
        name: i.name,
        unitType: i.unitType,
        orderedBaseQty,
        bufferBaseQty,
        requiredBaseQty: orderedBaseQty + bufferBaseQty,
        alreadyPoBaseQty: onPo.get(i.id) ?? 0,
        bestRate: r[0] ?? null,
        rates: r,
      };
    })
    .sort((a, b) => b.requiredBaseQty - a.requiredBaseQty || a.name.localeCompare(b.name));
  res.json({ date, bufferPct: area.demandBufferPct, rows });
});

supplyRouter.get('/vendors', async (req, res) => {
  const areaId = scopeArea(req);
  const vendors = await prisma.vendor.findMany({
    where: { areaId, user: { status: 'ACTIVE' } },
    include: { user: { select: { phone: true, name: true } } },
    orderBy: { businessName: 'asc' },
  });
  res.json(vendors.map((v) => ({ id: v.id, businessName: v.businessName, phone: v.user.phone, contactName: v.user.name })));
});

supplyRouter.get('/pos', async (req, res) => {
  const areaId = scopeArea(req);
  const status = q(req, 'status');
  const rows = await prisma.purchaseOrder.findMany({
    where: {
      areaId,
      ...(q(req, 'date') ? { forDate: ymdToDate(parse(ymdSchema, q(req, 'date'))) } : {}),
      ...(q(req, 'vendorId') ? { vendorId: q(req, 'vendorId') } : {}),
      ...(status ? { status: { in: status.split(',') as PoStatus[] } } : {}),
    },
    include: poInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(rows.map(toPo));
});

supplyRouter.get('/pos/:id', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: param(req, 'id') }, include: poInclude });
  if (!po) throw notFound('Purchase order');
  assertSameArea(req, po.areaId);
  res.json(toPo(po));
});

supplyRouter.post('/pos', async (req, res) => {
  const areaId = scopeArea(req);
  const input = body(req, poCreateSchema);
  const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, areaId }, include: { user: true } });
  if (!vendor) throw badRequest('Vendor not found in this area');
  const valid = await prisma.item.count({ where: { id: { in: input.items.map((i) => i.itemId) }, areaId } });
  if (valid !== new Set(input.items.map((i) => i.itemId)).size) throw badRequest('Unknown item on purchase order');

  const po = await prisma.$transaction(async (tx) =>
    tx.purchaseOrder.create({
      data: {
        poNo: await nextPoNo(tx, areaId),
        areaId,
        vendorId: vendor.id,
        forDate: ymdToDate(input.forDate),
        note: input.note,
        createdById: me(req).sub,
        items: { create: input.items },
      },
      include: poInclude,
    }),
  );
  await audit({ actorId: me(req).sub, areaId, action: 'po.create', entity: 'PurchaseOrder', entityId: po.id });
  await notify([vendor.userId], { title: `New purchase order ${po.poNo}`, body: `For ${input.forDate} · ${input.items.length} items`, data: { poId: po.id } });
  res.status(201).json(toPo(po));
});

/** Goods receipt: records what physically arrived, books the payable and optionally adds to sellable stock. */
supplyRouter.post('/pos/:id/receive', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: param(req, 'id') }, include: poInclude });
  if (!po) throw notFound('Purchase order');
  assertSameArea(req, po.areaId);
  if (!['SENT', 'ACCEPTED', 'ADJUSTED'].includes(po.status)) throw badRequest('Goods were already received for this order');
  const { items, addToStockDate } = body(req, poReceiveSchema);
  const received = new Map(items.map((i) => [i.poItemId, i.receivedQty]));
  const actorId = me(req).sub;

  await prisma.$transaction(async (tx) => {
    let total = 0;
    for (const it of po.items) {
      const qty = received.get(it.id) ?? 0;
      await tx.poItem.update({ where: { id: it.id }, data: { receivedQty: qty } });
      if (qty <= 0) continue;
      total += costPaise(it.item.unitType, qty, it.ratePaise);
      await tx.stockMovement.create({
        data: { areaId: po.areaId, itemId: it.itemId, type: 'PURCHASE', qty, refType: 'PurchaseOrder', refId: po.id, actorId },
      });
      if (addToStockDate) {
        const d = ymdToDate(addToStockDate);
        await tx.dailyStock.upsert({
          where: { itemId_date: { itemId: it.itemId, date: d } },
          update: { availableQty: { increment: qty } },
          create: { areaId: po.areaId, itemId: it.itemId, date: d, availableQty: qty },
        });
      }
    }
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED' } });
    if (total > 0) {
      await tx.vendorLedger.create({
        data: { vendorId: po.vendorId, areaId: po.areaId, type: 'PAYABLE', amountPaise: total, poId: po.id, note: `Goods received ${po.poNo}`, actorId },
      });
    }
  });
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: po.vendorId } });
  await notify([vendor.userId], { title: `Goods received for ${po.poNo}`, body: 'Payment has been added to your ledger.', data: { poId: po.id } });
  res.json(toPo(await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: poInclude })));
});

supplyRouter.post('/pos/:id/close', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: param(req, 'id') } });
  if (!po) throw notFound('Purchase order');
  assertSameArea(req, po.areaId);
  const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'CLOSED' }, include: poInclude });
  res.json(toPo(updated));
});
