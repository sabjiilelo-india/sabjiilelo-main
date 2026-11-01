import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { deliverSchema, riderOnlineSchema, todayIST, ymdSchema, ymdToDate, type RiderCashSummary } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param, parse, q } from '../lib/http';
import { forbidden } from '../lib/errors';
import { authenticate, me, requireRole } from '../middleware/auth';
import { loadOrder, orderSummaryInclude, riderDeliver, riderStart, toOrderDetail, toOrderSummary, type Actor } from '../services/orders';

/** Delivery partner app. */
export const riderRouter = Router();
riderRouter.use(authenticate, requireRole('DELIVERY'));

function actor(req: Parameters<typeof me>[0]): Actor {
  const u = me(req);
  return { id: u.sub, role: 'DELIVERY', name: u.name ?? 'Delivery partner', areaId: u.areaId };
}

riderRouter.post('/online', async (req, res) => {
  const { isOnline } = body(req, riderOnlineSchema);
  const u = await prisma.user.update({ where: { id: me(req).sub }, data: { isOnline } });
  res.json({ isOnline: u.isOnline });
});

riderRouter.get('/orders', async (req, res) => {
  const riderId = me(req).sub;
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const where: Prisma.OrderWhereInput =
    q(req, 'scope') === 'done'
      ? { riderId, status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'] }, slotDate: ymdToDate(date) }
      : { riderId, status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] } };
  const rows = await prisma.order.findMany({
    where,
    include: orderSummaryInclude,
    orderBy: [{ slotDate: 'asc' }, { slot: { startTime: 'asc' } }, { pincode: 'asc' }],
  });
  res.json(rows.map(toOrderSummary));
});

riderRouter.get('/orders/:id', async (req, res) => {
  const o = await loadOrder(param(req, 'id'));
  if (o.riderId !== me(req).sub) throw forbidden('This order is not assigned to you');
  res.json(toOrderDetail(o));
});

riderRouter.post('/orders/:id/start', async (req, res) => {
  res.json(toOrderDetail(await riderStart(param(req, 'id'), actor(req))));
});

riderRouter.post('/orders/:id/deliver', async (req, res) => {
  const input = body(req, deliverSchema);
  res.json(toOrderDetail(await riderDeliver(param(req, 'id'), actor(req), input)));
});

riderRouter.get('/cash', async (req, res) => {
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const d = ymdToDate(date);
  const [row, deliveredCount] = await Promise.all([
    prisma.riderCashDay.findUnique({ where: { riderId_date: { riderId: me(req).sub, date: d } } }),
    prisma.order.count({
      where: { riderId: me(req).sub, status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }, deliveredAt: { gte: new Date(d.getTime() - 330 * 60_000) } },
    }),
  ]);
  const out: RiderCashSummary = {
    date,
    codExpectedPaise: row?.codExpectedPaise ?? 0,
    depositedPaise: row?.depositedPaise ?? 0,
    status: row?.status ?? 'OPEN',
    deliveredCount,
  };
  res.json(out);
});
