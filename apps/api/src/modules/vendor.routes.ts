import { Router } from 'express';
import { poRespondSchema, todayIST, vendorRatesSchema, ymdSchema, ymdToDate, type VendorRate } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param, parse, q } from '../lib/http';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { authenticate, me, requireRole } from '../middleware/auth';
import { notify } from '../services/notifier';
import { poInclude, toLedger, toPo } from '../services/supply';

/** Vendor (supplier) app: daily rates, purchase orders, supply & payment history. */
export const vendorRouter = Router();
vendorRouter.use(authenticate, requireRole('VENDOR'));

async function myVendor(userId: string) {
  const v = await prisma.vendor.findUnique({ where: { userId } });
  if (!v) throw forbidden('Your vendor profile is not set up. Contact your area admin.');
  return v;
}

vendorRouter.get('/profile', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const area = await prisma.area.findUniqueOrThrow({ where: { id: v.areaId }, select: { id: true, code: true, name: true, city: true } });
  res.json({ ...v, area });
});

vendorRouter.get('/rates', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const [items, rates] = await Promise.all([
    prisma.item.findMany({ where: { areaId: v.areaId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, unitType: true } }),
    prisma.vendorRate.findMany({ where: { vendorId: v.id, date: ymdToDate(date) } }),
  ]);
  const byItem = new Map(rates.map((r) => [r.itemId, r.ratePaise]));
  const out: VendorRate[] = items.map((i) => ({ itemId: i.id, name: i.name, unitType: i.unitType, ratePaise: byItem.get(i.id) ?? null }));
  res.json({ date, rates: out });
});

vendorRouter.put('/rates', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const { date, rates } = body(req, vendorRatesSchema);
  const valid = await prisma.item.count({ where: { id: { in: rates.map((r) => r.itemId) }, areaId: v.areaId } });
  if (valid !== rates.length) throw badRequest('Unknown item in rate list');
  const d = ymdToDate(date);
  await prisma.$transaction(
    rates.map((r) =>
      prisma.vendorRate.upsert({
        where: { vendorId_itemId_date: { vendorId: v.id, itemId: r.itemId, date: d } },
        update: { ratePaise: r.ratePaise },
        create: { vendorId: v.id, itemId: r.itemId, date: d, ratePaise: r.ratePaise },
      }),
    ),
  );
  res.json({ ok: true, saved: rates.length });
});

vendorRouter.get('/pos', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const status = q(req, 'status');
  const rows = await prisma.purchaseOrder.findMany({
    where: { vendorId: v.id, ...(status ? { status: { in: status.split(',') as never[] } } : {}) },
    include: poInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows.map(toPo));
});

vendorRouter.get('/pos/:id', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: param(req, 'id') }, include: poInclude });
  if (!po || po.vendorId !== v.id) throw notFound('Purchase order');
  res.json(toPo(po));
});

vendorRouter.post('/pos/:id/respond', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: param(req, 'id') }, include: poInclude });
  if (!po || po.vendorId !== v.id) throw notFound('Purchase order');
  if (!['SENT', 'ADJUSTED', 'ACCEPTED'].includes(po.status)) throw badRequest('This purchase order can no longer be changed');
  const { action, note, items } = body(req, poRespondSchema);

  await prisma.$transaction(async (tx) => {
    if (action === 'REJECT') {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'REJECTED', vendorNote: note } });
      return;
    }
    const changes = new Map(items.map((i) => [i.poItemId, i]));
    let adjusted = false;
    for (const it of po.items) {
      const c = changes.get(it.id);
      const acceptedQty = action === 'ACCEPT' ? it.orderedQty : c?.acceptedQty ?? it.orderedQty;
      const ratePaise = c?.ratePaise ?? it.ratePaise;
      if (acceptedQty !== it.orderedQty || ratePaise !== it.ratePaise) adjusted = true;
      await tx.poItem.update({ where: { id: it.id }, data: { acceptedQty, ratePaise } });
    }
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: adjusted ? 'ADJUSTED' : 'ACCEPTED', vendorNote: note } });
  });

  const ops = await prisma.user.findMany({ where: { areaId: v.areaId, role: { in: ['ADMIN', 'MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
  await notify(
    ops.map((u) => u.id),
    { title: `${po.poNo} ${action === 'REJECT' ? 'rejected' : action === 'ADJUST' ? 'adjusted' : 'accepted'}`, body: `${v.businessName}${note ? `: ${note}` : ''}`, data: { poId: po.id } },
  );
  res.json(toPo(await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: poInclude })));
});

vendorRouter.get('/ledger', async (req, res) => {
  const v = await myVendor(me(req).sub);
  const rows = await prisma.vendorLedger.findMany({ where: { vendorId: v.id }, include: { po: { select: { poNo: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  const payable = rows.filter((r) => r.type === 'PAYABLE').reduce((s, r) => s + r.amountPaise, 0);
  const paid = rows.filter((r) => r.type === 'PAYMENT').reduce((s, r) => s + r.amountPaise, 0);
  res.json({ payablePaise: payable, paidPaise: paid, balancePaise: payable - paid, entries: rows.map(toLedger) });
});
