import { Router } from 'express';
import {
  codSettleSchema,
  issueResolveSchema,
  refundDecisionSchema,
  todayIST,
  vendorPaymentSchema,
  ymdSchema,
  ymdToDate,
  type CodRow,
  type VendorBalance,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param, parse, q } from '../lib/http';
import { notFound } from '../lib/errors';
import { audit } from '../lib/audit';
import { toIssue, toRefund } from '../lib/serializers';
import { assertSameArea, authenticate, me, requirePermission, scopeArea } from '../middleware/auth';
import { notify } from '../services/notifier';
import { decideRefund, resolveIssue, type Actor } from '../services/orders';
import { toLedger } from '../services/supply';

/** Accountant: cash from riders, vendor payouts, refunds and customer issues. */
export const accountsRouter = Router();
accountsRouter.use(authenticate, requirePermission('accounts'));

function actor(req: Parameters<typeof me>[0]): Actor {
  const u = me(req);
  return { id: u.sub, role: u.role, name: u.name ?? u.role, areaId: u.role === 'SUPERADMIN' ? null : u.areaId };
}

const IST_MS = 330 * 60_000;

// ---------------------------------------------------------------- COD reconciliation

accountsRouter.get('/cod', async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const d = ymdToDate(date);
  const dayStart = new Date(d.getTime() - IST_MS);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const [riders, cash, delivered] = await Promise.all([
    prisma.user.findMany({ where: { areaId, role: 'DELIVERY' }, orderBy: { name: 'asc' } }),
    prisma.riderCashDay.findMany({ where: { areaId, date: d } }),
    prisma.order.groupBy({
      by: ['riderId'],
      where: { areaId, paymentMode: 'COD', status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }, deliveredAt: { gte: dayStart, lt: dayEnd } },
      _count: true,
    }),
  ]);
  const rows: CodRow[] = riders
    .map((r) => {
      const c = cash.find((x) => x.riderId === r.id);
      return {
        riderId: r.id,
        riderName: r.name,
        phone: r.phone,
        date,
        deliveredCount: delivered.find((x) => x.riderId === r.id)?._count ?? 0,
        codExpectedPaise: c?.codExpectedPaise ?? 0,
        depositedPaise: c?.depositedPaise ?? 0,
        status: c?.status ?? 'OPEN',
        note: c?.note ?? null,
      };
    })
    .filter((r) => r.codExpectedPaise > 0 || r.deliveredCount > 0 || r.depositedPaise > 0);
  res.json({
    date,
    rows,
    totals: {
      expectedPaise: rows.reduce((s, r) => s + r.codExpectedPaise, 0),
      depositedPaise: rows.reduce((s, r) => s + r.depositedPaise, 0),
    },
  });
});

accountsRouter.post('/cod/:riderId/settle', async (req, res) => {
  const areaId = scopeArea(req);
  const rider = await prisma.user.findUnique({ where: { id: param(req, 'riderId') } });
  if (!rider || rider.role !== 'DELIVERY') throw notFound('Delivery partner');
  assertSameArea(req, rider.areaId);
  const { date, depositedPaise, note } = body(req, codSettleSchema);
  const d = ymdToDate(date);
  const existing = await prisma.riderCashDay.findUnique({ where: { riderId_date: { riderId: rider.id, date: d } } });
  const expected = existing?.codExpectedPaise ?? 0;
  const row = await prisma.riderCashDay.upsert({
    where: { riderId_date: { riderId: rider.id, date: d } },
    update: { depositedPaise, note, receivedById: me(req).sub, status: depositedPaise >= expected ? 'SETTLED' : 'SHORT' },
    create: { riderId: rider.id, areaId, date: d, depositedPaise, note, receivedById: me(req).sub, status: depositedPaise >= expected ? 'SETTLED' : 'SHORT' },
  });
  await audit({ actorId: me(req).sub, areaId, action: 'cod.settle', entity: 'RiderCashDay', entityId: row.id, data: { expected, depositedPaise } });
  res.json(row);
});

// ---------------------------------------------------------------- vendor payouts

accountsRouter.get('/vendors', async (req, res) => {
  const areaId = scopeArea(req);
  const [vendors, sums] = await Promise.all([
    prisma.vendor.findMany({ where: { areaId }, include: { user: { select: { phone: true } } }, orderBy: { businessName: 'asc' } }),
    prisma.vendorLedger.groupBy({ by: ['vendorId', 'type'], where: { areaId }, _sum: { amountPaise: true } }),
  ]);
  const rows: VendorBalance[] = vendors.map((v) => {
    const payable = sums.find((s) => s.vendorId === v.id && s.type === 'PAYABLE')?._sum.amountPaise ?? 0;
    const paid = sums.find((s) => s.vendorId === v.id && s.type === 'PAYMENT')?._sum.amountPaise ?? 0;
    return { vendorId: v.id, userId: v.userId, businessName: v.businessName, phone: v.user.phone, payablePaise: payable, paidPaise: paid, balancePaise: payable - paid };
  });
  res.json(rows);
});

accountsRouter.get('/vendors/:vendorId/ledger', async (req, res) => {
  const v = await prisma.vendor.findUnique({ where: { id: param(req, 'vendorId') } });
  if (!v) throw notFound('Vendor');
  assertSameArea(req, v.areaId);
  const rows = await prisma.vendorLedger.findMany({ where: { vendorId: v.id }, include: { po: { select: { poNo: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ vendor: { id: v.id, businessName: v.businessName, bankAccount: v.bankAccount, ifsc: v.ifsc, upiId: v.upiId }, entries: rows.map(toLedger) });
});

accountsRouter.post('/vendors/:vendorId/payments', async (req, res) => {
  const v = await prisma.vendor.findUnique({ where: { id: param(req, 'vendorId') } });
  if (!v) throw notFound('Vendor');
  assertSameArea(req, v.areaId);
  const input = body(req, vendorPaymentSchema);
  const entry = await prisma.vendorLedger.create({
    data: { vendorId: v.id, areaId: v.areaId, type: 'PAYMENT', amountPaise: input.amountPaise, reference: input.reference, note: input.note, actorId: me(req).sub },
    include: { po: { select: { poNo: true } } },
  });
  await audit({ actorId: me(req).sub, areaId: v.areaId, action: 'vendor.payment', entity: 'VendorLedger', entityId: entry.id, data: input });
  await notify([v.userId], { title: 'Payment sent', body: `₹${(input.amountPaise / 100).toFixed(2)} paid${input.reference ? ` (ref ${input.reference})` : ''}.` });
  res.status(201).json(toLedger(entry));
});

// ---------------------------------------------------------------- refunds & issues

accountsRouter.get('/refunds', async (req, res) => {
  const areaId = scopeArea(req);
  const status = q(req, 'status') ?? 'REQUESTED';
  const rows = await prisma.refund.findMany({
    where: { order: { areaId }, ...(status === 'ALL' ? {} : { status: status as never }) },
    include: { order: { select: { orderNo: true, paymentMode: true, customerName: true, customerPhone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(rows.map(toRefund));
});

accountsRouter.post('/refunds/:id/approve', async (req, res) => {
  const { note } = body(req, refundDecisionSchema);
  res.json(toRefund(await decideRefund(param(req, 'id'), actor(req), true, note)));
});

accountsRouter.post('/refunds/:id/reject', async (req, res) => {
  const { note } = body(req, refundDecisionSchema);
  res.json(toRefund(await decideRefund(param(req, 'id'), actor(req), false, note)));
});

accountsRouter.get('/issues', async (req, res) => {
  const areaId = scopeArea(req);
  const status = q(req, 'status') ?? 'OPEN';
  const rows = await prisma.issueReport.findMany({
    where: { order: { areaId }, ...(status === 'ALL' ? {} : { status: status as never }) },
    include: {
      orderItem: { select: { name: true, pricePaise: true, qty: true, packedQty: true, rejectedQty: true } },
      order: { select: { orderNo: true, customerName: true, customerPhone: true, paymentMode: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(
    rows.map((i) => ({
      ...toIssue(i),
      paymentMode: i.order.paymentMode,
      suggestedRefundPaise: i.orderItem ? i.orderItem.pricePaise * Math.max(0, (i.orderItem.packedQty ?? i.orderItem.qty) - i.orderItem.rejectedQty) : 0,
    })),
  );
});

accountsRouter.post('/issues/:id/resolve', async (req, res) => {
  const { action, refundPaise, note } = body(req, issueResolveSchema);
  await resolveIssue(param(req, 'id'), actor(req), action === 'APPROVE', refundPaise, note);
  res.json({ ok: true });
});
