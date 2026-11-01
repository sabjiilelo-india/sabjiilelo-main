import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import {
  ACTIVE_ORDER_STATUSES,
  effectiveLineQty,
  todayIST,
  addDays,
  ymdSchema,
  ymdToDate,
  type DashboardSummary,
  type OrderChannel,
  type PaymentMode,
  type SalesReport,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { parse, q } from '../lib/http';
import { badRequest } from '../lib/errors';
import { authenticate, requirePermission, scopeArea } from '../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

const SOLD: Prisma.OrderWhereInput['status'] = { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] };

function range(req: Parameters<typeof q>[0]) {
  const to = q(req, 'to') ? parse(ymdSchema, q(req, 'to')) : todayIST();
  const from = q(req, 'from') ? parse(ymdSchema, q(req, 'from')) : addDays(to, -6);
  if (from > to) throw badRequest('From date must be before To date');
  return { from, to };
}

async function salesReport(areaId: string, from: string, to: string): Promise<SalesReport> {
  const orders = await prisma.order.findMany({
    where: { areaId, status: SOLD, slotDate: { gte: ymdToDate(from), lte: ymdToDate(to) } },
    include: { items: true, refunds: { where: { status: 'PROCESSED' } } },
  });
  const byDay = new Map<string, { orders: number; netPaise: number }>();
  const byMode = new Map<PaymentMode, { orders: number; netPaise: number }>();
  const byChannel = new Map<OrderChannel, { orders: number; netPaise: number }>();
  const items = new Map<string, SalesReport['topItems'][number]>();
  const totals = { orders: 0, grossPaise: 0, discountPaise: 0, deliveryFeePaise: 0, refundsPaise: 0, netPaise: 0 };

  for (const o of orders) {
    const refunds = o.refunds.reduce((s, r) => s + r.amountPaise, 0);
    // Prepaid: final payable already excludes doorstep/shortage refunds; issue refunds come off afterwards.
    const issueRefunds = o.refunds.filter((r) => r.source === 'ISSUE').reduce((s, r) => s + r.amountPaise, 0);
    const net = Math.max(0, (o.paymentMode === 'COD' ? o.codCollectedPaise ?? o.finalPayablePaise : o.finalPayablePaise) - issueRefunds);
    const day = o.slotDate!.toISOString().slice(0, 10);
    totals.orders++;
    totals.grossPaise += o.subtotalPaise;
    totals.discountPaise += o.discountPaise;
    totals.deliveryFeePaise += o.deliveryFeePaise;
    totals.refundsPaise += refunds;
    totals.netPaise += net;
    for (const [map, key] of [
      [byDay, day],
      [byMode, o.paymentMode],
      [byChannel, o.channel],
    ] as const) {
      const cur = (map as Map<string, { orders: number; netPaise: number }>).get(key) ?? { orders: 0, netPaise: 0 };
      cur.orders++;
      cur.netPaise += net;
      (map as Map<string, { orders: number; netPaise: number }>).set(key, cur);
    }
    for (const it of o.items) {
      const qty = effectiveLineQty(it);
      const row = items.get(it.itemId) ?? { itemId: it.itemId, name: it.name, unitType: it.unitType, baseQty: 0, revenuePaise: 0 };
      row.baseQty += qty * it.baseQty;
      row.revenuePaise += qty * it.pricePaise;
      items.set(it.itemId, row);
    }
  }
  const days: SalesReport['byDay'] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, ...(byDay.get(d) ?? { orders: 0, netPaise: 0 }) });
  return {
    from,
    to,
    totals,
    byDay: days,
    byPaymentMode: [...byMode].map(([mode, v]) => ({ mode, ...v })),
    byChannel: [...byChannel].map(([channel, v]) => ({ channel, ...v })),
    topItems: [...items.values()].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, 20),
  };
}

reportsRouter.get('/sales', requirePermission('reports'), async (req, res) => {
  const { from, to } = range(req);
  res.json(await salesReport(scopeArea(req), from, to));
});

function sendCsv(res: Response, name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n'));
}

const rupees = (p: number | null | undefined) => ((p ?? 0) / 100).toFixed(2);

reportsRouter.get('/orders.csv', requirePermission('reports'), async (req, res) => {
  const areaId = scopeArea(req);
  const { from, to } = range(req);
  const orders = await prisma.order.findMany({
    where: { areaId, slotDate: { gte: ymdToDate(from), lte: ymdToDate(to) }, status: { not: 'PAYMENT_PENDING' } },
    include: { slot: { select: { label: true } }, refunds: { where: { status: 'PROCESSED' } }, rider: { select: { name: true } } },
    orderBy: [{ slotDate: 'asc' }, { orderNo: 'asc' }],
  });
  sendCsv(
    res,
    `orders-${from}-to-${to}.csv`,
    ['Date', 'Order No', 'Bill No', 'Channel', 'Slot', 'Status', 'Customer', 'Phone', 'Pincode', 'Payment', 'Payment status', 'Item total', 'Discount', 'Delivery fee', 'Order total', 'Final payable', 'COD collected', 'Refunded', 'Rider'],
    orders.map((o) => [
      o.slotDate?.toISOString().slice(0, 10) ?? '',
      o.orderNo,
      o.invoiceNo,
      o.channel,
      o.slot?.label ?? '',
      o.status,
      o.customerName,
      o.customerPhone,
      o.pincode,
      o.paymentMode,
      o.paymentStatus,
      rupees(o.subtotalPaise),
      rupees(o.discountPaise),
      rupees(o.deliveryFeePaise),
      rupees(o.totalPaise),
      rupees(o.finalPayablePaise),
      o.codCollectedPaise == null ? '' : rupees(o.codCollectedPaise),
      rupees(o.refunds.reduce((s, r) => s + r.amountPaise, 0)),
      o.rider?.name ?? '',
    ]),
  );
});

reportsRouter.get('/items.csv', requirePermission('reports'), async (req, res) => {
  const { from, to } = range(req);
  const r = await salesReport(scopeArea(req), from, to);
  sendCsv(
    res,
    `items-${from}-to-${to}.csv`,
    ['Item', 'Unit', 'Quantity (base units)', 'Revenue'],
    r.topItems.map((i) => [i.name, i.unitType, i.baseQty, rupees(i.revenuePaise)]),
  );
});

reportsRouter.get('/purchases.csv', requirePermission('reports'), async (req, res) => {
  const areaId = scopeArea(req);
  const { from, to } = range(req);
  const pos = await prisma.purchaseOrder.findMany({
    where: { areaId, forDate: { gte: ymdToDate(from), lte: ymdToDate(to) } },
    include: { vendor: { select: { businessName: true } }, items: { include: { item: { select: { name: true, unitType: true } } } } },
    orderBy: { forDate: 'asc' },
  });
  sendCsv(
    res,
    `purchases-${from}-to-${to}.csv`,
    ['Date', 'PO No', 'Vendor', 'Status', 'Item', 'Unit', 'Ordered', 'Accepted', 'Received', 'Rate'],
    pos.flatMap((p) =>
      p.items.map((i) => [
        p.forDate.toISOString().slice(0, 10),
        p.poNo,
        p.vendor.businessName,
        p.status,
        i.item.name,
        i.item.unitType,
        i.orderedQty,
        i.acceptedQty,
        i.receivedQty,
        rupees(i.ratePaise),
      ]),
    ),
  );
});

reportsRouter.get('/dashboard', requirePermission('viewOrders'), async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const d = ymdToDate(date);
  const nextDate = addDays(date, 1);
  const weekStart = addDays(date, -6);
  // 'Placed today' is by IST calendar day of creation, independent of the delivery slot.
  const dayStart = new Date(ymdToDate(todayIST()).getTime() - 330 * 60_000);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const liveStatus = { notIn: ['PAYMENT_PENDING', 'CANCELLED'] } as Prisma.EnumOrderStatusFilter;

  const [orders, slots, stock, items, pendingRefunds, openIssues, onlineRiders, rating, placed, next, week, team, pendingPos, cash] = await Promise.all([
    prisma.order.findMany({
      where: { areaId, slotDate: d, status: { not: 'PAYMENT_PENDING' } },
      select: { status: true, slotId: true, finalPayablePaise: true, channel: true },
    }),
    prisma.deliverySlot.findMany({ where: { areaId }, orderBy: { sort: 'asc' } }),
    prisma.dailyStock.findMany({ where: { areaId, date: d, item: { isActive: true } }, include: { item: { select: { name: true } } } }),
    prisma.item.count({ where: { areaId, isActive: true } }),
    prisma.refund.count({ where: { order: { areaId }, status: 'REQUESTED' } }),
    prisma.issueReport.count({ where: { order: { areaId }, status: 'OPEN' } }),
    prisma.user.count({ where: { areaId, role: 'DELIVERY', isOnline: true, status: 'ACTIVE' } }),
    prisma.rating.aggregate({ where: { order: { areaId } }, _avg: { stars: true }, _count: true }),
    prisma.order.aggregate({ where: { areaId, createdAt: { gte: dayStart, lt: dayEnd }, status: liveStatus }, _count: true, _sum: { finalPayablePaise: true } }),
    prisma.order.aggregate({ where: { areaId, slotDate: ymdToDate(nextDate), status: liveStatus }, _count: true, _sum: { finalPayablePaise: true } }),
    prisma.order.findMany({
      where: { areaId, slotDate: { gte: ymdToDate(weekStart), lte: d }, status: liveStatus },
      select: { slotDate: true, finalPayablePaise: true },
    }),
    prisma.user.groupBy({ by: ['role'], where: { areaId, status: 'ACTIVE', role: { not: 'CUSTOMER' } }, _count: true }),
    prisma.purchaseOrder.count({ where: { areaId, status: { in: ['SENT', 'ACCEPTED', 'ADJUSTED'] } } }),
    prisma.riderCashDay.findMany({ where: { areaId, status: { not: 'SETTLED' } }, select: { codExpectedPaise: true, depositedPaise: true } }),
  ]);

  const live = orders.filter((o) => o.status !== 'CANCELLED');
  const statusCounts: DashboardSummary['statusCounts'] = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  const last7Days: DashboardSummary['last7Days'] = [];
  for (let day = weekStart; day <= date; day = addDays(day, 1)) {
    const list = week.filter((o) => o.slotDate?.toISOString().slice(0, 10) === day);
    last7Days.push({ date: day, orders: list.length, valuePaise: list.reduce((s, o) => s + o.finalPayablePaise, 0) });
  }
  const roleCount = (r: string) => team.find((t) => t.role === r)?._count ?? 0;
  const soldOut = stock.filter((r) => r.availableQty - r.reservedQty <= 0);

  const body: DashboardSummary = {
    date,
    ordersBySlot: [
      ...slots.map((s) => ({ slotId: s.id, label: s.label, count: live.filter((o) => o.slotId === s.id).length })),
      { slotId: null, label: 'Counter', count: live.filter((o) => o.channel === 'POS').length },
    ],
    statusCounts,
    revenuePaise: live.reduce((s, o) => s + o.finalPayablePaise, 0),
    ordersCount: live.length,
    activeOrders: live.filter((o) => (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status)).length,
    soldOutItems: soldOut.map((r) => ({ itemId: r.itemId, name: r.item.name })),
    pendingRefunds,
    openIssues,
    onlineRiders,
    avgRating: rating._avg.stars,
    ratingsCount: rating._count,
    placedToday: { count: placed._count, valuePaise: placed._sum.finalPayablePaise ?? 0 },
    nextDay: { date: nextDate, count: next._count, valuePaise: next._sum.finalPayablePaise ?? 0 },
    last7Days,
    catalog: { items, inStock: stock.length - soldOut.length, soldOut: soldOut.length, notStocked: Math.max(0, items - stock.length) },
    team: { riders: roleCount('DELIVERY'), vendors: roleCount('VENDOR'), staff: team.reduce((s, t) => s + t._count, 0) },
    pendingPos,
    codPendingPaise: cash.reduce((s, c) => s + Math.max(0, c.codExpectedPaise - c.depositedPaise), 0),
  };
  res.json(body);
});
