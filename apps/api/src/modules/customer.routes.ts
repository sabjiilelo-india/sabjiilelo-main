import { Router } from 'express';
import {
  addressUpsertSchema,
  cancelSchema,
  cartSetSchema,
  issueCreateSchema,
  placeOrderSchema,
  quoteSchema,
  ratingSchema,
  todayIST,
  ymdToDate,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, pageParams, param, q } from '../lib/http';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { toAddress, toCoupon } from '../lib/serializers';
import { authenticate, me, requireRole } from '../middleware/auth';
import { catalogDate } from '../services/slots';
import {
  cancelOrder,
  getCart,
  loadOrder,
  orderSummaryInclude,
  placeOrder,
  quote,
  rateOrder,
  reportIssue,
  toOrderDetail,
  toOrderSummary,
} from '../services/orders';

/** Everything a logged-in customer does: addresses, cart, checkout, orders. */
export const customerRouter = Router();
customerRouter.use(authenticate, requireRole('CUSTOMER'));

async function areaForPincode(pincode: string) {
  const row = await prisma.areaPincode.findUnique({ where: { pincode }, include: { area: { select: { isActive: true } } } });
  return row && row.area.isActive ? row.areaId : null;
}

// ---------------------------------------------------------------- addresses

customerRouter.get('/addresses', async (req, res) => {
  const rows = await prisma.address.findMany({
    where: { userId: me(req).sub, isDeleted: false },
    include: { area: { select: { isActive: true } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(rows.map((a) => toAddress(a, !!a.areaId && !!a.area?.isActive)));
});

customerRouter.post('/addresses', async (req, res) => {
  const userId = me(req).sub;
  const data = body(req, addressUpsertSchema);
  const areaId = await areaForPincode(data.pincode);
  const count = await prisma.address.count({ where: { userId, isDeleted: false } });
  const isDefault = data.isDefault || count === 0;
  const a = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, isDefault, userId, areaId } });
  });
  res.status(201).json(toAddress(a, !!areaId));
});

customerRouter.put('/addresses/:id', async (req, res) => {
  const userId = me(req).sub;
  const existing = await prisma.address.findFirst({ where: { id: param(req, 'id'), userId, isDeleted: false } });
  if (!existing) throw notFound('Address');
  const data = body(req, addressUpsertSchema);
  const areaId = await areaForPincode(data.pincode);
  const a = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.update({ where: { id: existing.id }, data: { ...data, areaId } });
  });
  res.json(toAddress(a, !!areaId));
});

customerRouter.delete('/addresses/:id', async (req, res) => {
  const existing = await prisma.address.findFirst({ where: { id: param(req, 'id'), userId: me(req).sub } });
  if (!existing) throw notFound('Address');
  // Soft delete: old orders keep their own snapshot anyway.
  await prisma.address.update({ where: { id: existing.id }, data: { isDeleted: true, isDefault: false } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- cart

customerRouter.get('/cart', async (req, res) => {
  const areaId = q(req, 'areaId');
  if (!areaId) throw badRequest('areaId is required');
  const { date } = await catalogDate(areaId);
  res.json(await getCart(me(req).sub, areaId, date));
});

customerRouter.put('/cart', async (req, res) => {
  const userId = me(req).sub;
  const { variantId, qty } = body(req, cartSetSchema);
  const variant = await prisma.itemVariant.findUnique({ where: { id: variantId }, include: { item: true } });
  if (!variant) throw notFound('Item');
  if (qty === 0) {
    await prisma.cartItem.deleteMany({ where: { userId, variantId } });
  } else {
    if (!variant.isActive || !variant.item.isActive) throw badRequest('This item is no longer available');
    await prisma.cartItem.upsert({ where: { userId_variantId: { userId, variantId } }, update: { qty }, create: { userId, variantId, qty } });
  }
  const { date } = await catalogDate(variant.item.areaId);
  res.json(await getCart(userId, variant.item.areaId, date));
});

customerRouter.delete('/cart', async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: me(req).sub } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- coupons & checkout

customerRouter.get('/coupons', async (req, res) => {
  const areaId = q(req, 'areaId');
  if (!areaId) throw badRequest('areaId is required');
  const today = ymdToDate(todayIST());
  const rows = await prisma.coupon.findMany({
    where: { areaId, isActive: true, validFrom: { lte: today }, validTo: { gte: today } },
    orderBy: { minOrderPaise: 'asc' },
  });
  res.json(rows.filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit).map(toCoupon));
});

customerRouter.post('/checkout/quote', async (req, res) => {
  const { addressId, couponCode } = body(req, quoteSchema);
  res.json(await quote(me(req).sub, addressId, couponCode));
});

customerRouter.post('/orders', async (req, res) => {
  const input = body(req, placeOrderSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).sub } });
  const order = await placeOrder({ id: user.id, name: user.name, phone: user.phone }, input);
  res.status(201).json({ order, razorpay: order.razorpay });
});

customerRouter.get('/orders', async (req, res) => {
  const { skip, take, page, pageSize } = pageParams(req);
  const where = { customerId: me(req).sub };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderSummaryInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.order.count({ where }),
  ]);
  res.json({ data: rows.map(toOrderSummary), total, page, pageSize });
});

async function ownOrder(orderId: string, userId: string) {
  const o = await loadOrder(orderId);
  if (o.customerId !== userId) throw forbidden();
  return o;
}

customerRouter.get('/orders/:id', async (req, res) => {
  const u = me(req);
  res.json(toOrderDetail(await ownOrder(param(req, 'id'), u.sub), { id: u.sub, role: u.role }));
});

customerRouter.post('/orders/:id/cancel', async (req, res) => {
  const u = me(req);
  const { reason } = body(req, cancelSchema);
  const o = await cancelOrder(param(req, 'id'), { id: u.sub, role: 'CUSTOMER', name: u.name ?? 'Customer' }, reason);
  res.json(toOrderDetail(o, { id: u.sub, role: u.role }));
});

customerRouter.post('/orders/:id/reorder', async (req, res) => {
  const u = me(req);
  const o = await ownOrder(param(req, 'id'), u.sub);
  const variantIds = o.items.map((i) => i.variantId).filter((x): x is string => !!x);
  const active = await prisma.itemVariant.findMany({ where: { id: { in: variantIds }, isActive: true, item: { isActive: true } } });
  const ok = new Set(active.map((v) => v.id));
  for (const it of o.items) {
    if (!it.variantId || !ok.has(it.variantId)) continue;
    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId: u.sub, variantId: it.variantId } },
      update: { qty: it.qty },
      create: { userId: u.sub, variantId: it.variantId, qty: it.qty },
    });
  }
  res.json({ added: ok.size, skipped: o.items.length - ok.size });
});

customerRouter.post('/orders/:id/rating', async (req, res) => {
  const u = me(req);
  const { stars, comment } = body(req, ratingSchema);
  res.json(toOrderDetail(await rateOrder(param(req, 'id'), u.sub, stars, comment), { id: u.sub, role: u.role }));
});

customerRouter.post('/orders/:id/issues', async (req, res) => {
  const u = me(req);
  const input = body(req, issueCreateSchema);
  res.status(201).json(toOrderDetail(await reportIssue(param(req, 'id'), u.sub, input), { id: u.sub, role: u.role }));
});
