import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  cancelSchema,
  dispatchSchema,
  packSchema,
  posOrderSchema,
  statusChangeSchema,
  todayIST,
  ymdSchema,
  ymdToDate,
  type OrderStatus,
  type PickListRow,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, pageParams, param, parse, q } from '../lib/http';
import { forbidden } from '../lib/errors';
import { assertSameArea, authenticate, me, requirePermission, scopeArea } from '../middleware/auth';
import {
  cancelOrder,
  changeStatus,
  dispatchOrders,
  loadOrder,
  orderSummaryInclude,
  packOrder,
  posOrder,
  toOrderDetail,
  toOrderSummary,
  type Actor,
} from '../services/orders';
import { renderInvoice } from '../services/invoice';

/** Store operations: order board, packing, dispatch, counter sales, invoices. */
export const opsRouter = Router();
opsRouter.use(authenticate);

function actor(req: Parameters<typeof me>[0]): Actor {
  const u = me(req);
  return { id: u.sub, role: u.role, name: u.name ?? u.role, areaId: u.role === 'SUPERADMIN' ? null : u.areaId };
}

opsRouter.get('/orders', requirePermission('viewOrders'), async (req, res) => {
  const areaId = scopeArea(req);
  const { skip, take, page, pageSize } = pageParams(req);
  const status = q(req, 'status');
  const search = q(req, 'q');
  const where: Prisma.OrderWhereInput = {
    areaId,
    ...(q(req, 'date') ? { slotDate: ymdToDate(parse(ymdSchema, q(req, 'date'))) } : {}),
    ...(q(req, 'slotId') ? { slotId: q(req, 'slotId') } : {}),
    ...(q(req, 'channel') ? { channel: q(req, 'channel') as Prisma.OrderWhereInput['channel'] } : {}),
    ...(status ? { status: { in: status.split(',') as OrderStatus[] } } : { status: { not: 'PAYMENT_PENDING' } }),
    ...(q(req, 'pincode') ? { pincode: q(req, 'pincode') } : {}),
    ...(q(req, 'riderId') ? { riderId: q(req, 'riderId') } : {}),
    ...(search
      ? { OR: [{ orderNo: { contains: search, mode: 'insensitive' } }, { customerPhone: { contains: search } }, { customerName: { contains: search, mode: 'insensitive' } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderSummaryInclude, orderBy: [{ slotDate: 'asc' }, { createdAt: 'asc' }], skip, take }),
    prisma.order.count({ where }),
  ]);
  res.json({ data: rows.map(toOrderSummary), total, page, pageSize });
});

opsRouter.get('/orders/:id', requirePermission('viewOrders'), async (req, res) => {
  const o = await loadOrder(param(req, 'id'));
  assertSameArea(req, o.areaId);
  res.json(toOrderDetail(o));
});

opsRouter.post('/orders/:id/status', requirePermission('operateOrders'), async (req, res) => {
  const o = await loadOrder(param(req, 'id'));
  assertSameArea(req, o.areaId);
  const { status, note } = body(req, statusChangeSchema);
  res.json(toOrderDetail(await changeStatus(o.id, status, actor(req), note)));
});

opsRouter.post('/orders/bulk-confirm', requirePermission('operateOrders'), async (req, res) => {
  const areaId = scopeArea(req);
  const ids = (req.body?.orderIds ?? []) as string[];
  const orders = await prisma.order.findMany({ where: { id: { in: ids }, areaId, status: 'PLACED' }, select: { id: true } });
  for (const o of orders) await changeStatus(o.id, 'CONFIRMED', actor(req));
  res.json({ confirmed: orders.length });
});

opsRouter.post('/orders/:id/pack', requirePermission('operateOrders'), async (req, res) => {
  const o = await loadOrder(param(req, 'id'));
  assertSameArea(req, o.areaId);
  const { items } = body(req, packSchema);
  res.json(toOrderDetail(await packOrder(o.id, actor(req), items)));
});

opsRouter.post('/orders/:id/cancel', requirePermission('operateOrders'), async (req, res) => {
  const o = await loadOrder(param(req, 'id'));
  assertSameArea(req, o.areaId);
  const { reason } = body(req, cancelSchema);
  res.json(toOrderDetail(await cancelOrder(o.id, actor(req), reason)));
});

opsRouter.post('/dispatch', requirePermission('operateOrders'), async (req, res) => {
  const { orderIds, riderId } = body(req, dispatchSchema);
  res.json({ assigned: await dispatchOrders(scopeArea(req), orderIds, riderId, actor(req)) });
});

opsRouter.get('/riders', requirePermission('viewOrders'), async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const [riders, counts] = await Promise.all([
    prisma.user.findMany({ where: { areaId, role: 'DELIVERY', status: 'ACTIVE' }, orderBy: [{ isOnline: 'desc' }, { name: 'asc' }] }),
    prisma.order.groupBy({
      by: ['riderId'],
      where: { areaId, slotDate: ymdToDate(date), status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] } },
      _count: true,
    }),
  ]);
  res.json(
    riders.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      isOnline: r.isOnline,
      assignedCount: counts.find((c) => c.riderId === r.id)?._count ?? 0,
    })),
  );
});

opsRouter.get('/picklist', requirePermission('viewOrders'), async (req, res) => {
  const areaId = scopeArea(req);
  const date = q(req, 'date') ? parse(ymdSchema, q(req, 'date')) : todayIST();
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        areaId,
        slotDate: ymdToDate(date),
        channel: { not: 'POS' },
        status: { in: ['PLACED', 'CONFIRMED', 'PACKING'] },
        ...(q(req, 'slotId') ? { slotId: q(req, 'slotId') } : {}),
      },
    },
    select: { itemId: true, name: true, unitType: true, baseQty: true, qty: true, variantLabel: true, orderId: true },
  });
  const map = new Map<string, PickListRow & { orderSet: Set<string> }>();
  for (const it of items) {
    const row =
      map.get(it.itemId) ??
      ({ itemId: it.itemId, name: it.name, unitType: it.unitType, totalBaseQty: 0, orders: 0, variants: [], orderSet: new Set() } as PickListRow & { orderSet: Set<string> });
    row.totalBaseQty += it.baseQty * it.qty;
    row.orderSet.add(it.orderId);
    const v = row.variants.find((x) => x.label === it.variantLabel);
    if (v) v.qty += it.qty;
    else row.variants.push({ label: it.variantLabel, qty: it.qty });
    map.set(it.itemId, row);
  }
  const rows: PickListRow[] = [...map.values()]
    .map(({ orderSet, ...r }) => ({ ...r, orders: orderSet.size }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ date, rows });
});

opsRouter.post('/pos/orders', requirePermission('pos'), async (req, res) => {
  const input = body(req, posOrderSchema);
  res.status(201).json(toOrderDetail(await posOrder(scopeArea(req), actor(req), input)));
});

/** Bill of Supply or packing slip PDF. Customers may download their own bills. */
export const invoiceRouter = Router();
// The mobile app opens bills in the system browser, which cannot send headers, so a
// (15-minute) access token may also arrive as ?token=.
invoiceRouter.use((req, _res, next) => {
  const token = q(req, 'token');
  if (token && !req.headers.authorization) req.headers.authorization = `Bearer ${token}`;
  next();
});
invoiceRouter.get('/:id/:kind.pdf', authenticate, async (req, res) => {
  const u = me(req);
  const o = await loadOrder(param(req, 'id'));
  if (u.role === 'CUSTOMER') {
    if (o.customerId !== u.sub) throw forbidden();
  } else if (u.role === 'SUPERADMIN' || ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(u.role)) {
    assertSameArea(req, o.areaId);
  } else if (u.role === 'DELIVERY') {
    if (o.riderId !== u.sub) throw forbidden();
  } else {
    throw forbidden();
  }
  const kind = param(req, 'kind') === 'packing-slip' ? 'PACKING_SLIP' : 'BILL';
  const area = await prisma.area.findUniqueOrThrow({ where: { id: o.areaId } });
  const addr = o.addressSnapshot as { line1: string; landmark: string | null; city: string; pincode: string } | null;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${o.orderNo}-${kind === 'BILL' ? 'bill' : 'packing-slip'}.pdf"`);
  renderInvoice(
    {
      kind,
      invoiceNo: o.invoiceNo,
      orderNo: o.orderNo,
      date: o.deliveredAt ?? o.placedAt ?? o.createdAt,
      area: { name: area.name, city: area.city },
      customer: {
        name: o.customerName,
        phone: o.customerPhone,
        address: addr ? [addr.line1, addr.landmark, `${addr.city} - ${addr.pincode}`].filter(Boolean).join(', ') : null,
      },
      slot: o.slot && o.slotDate ? `${o.slotDate.toISOString().slice(0, 10)} ${o.slot.label} (${o.slot.startTime}-${o.slot.endTime})` : null,
      paymentMode: o.paymentMode,
      paymentStatus: o.paymentStatus,
      items: o.items,
      subtotalPaise: o.subtotalPaise,
      discountPaise: o.discountPaise,
      deliveryFeePaise: o.deliveryFeePaise,
      finalPayablePaise: o.finalPayablePaise,
      refundedPaise: o.refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amountPaise, 0),
    },
    res,
  );
});
