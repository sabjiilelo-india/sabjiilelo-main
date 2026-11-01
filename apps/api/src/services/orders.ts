import type { Prisma } from '@prisma/client';
import {
  canTransition,
  computeTotals,
  effectiveLineQty,
  finalPayable,
  formatINR,
  slotCutoff,
  todayIST,
  ymdToDate,
  ORDER_STATUS_LABEL,
  type CartLine,
  type DeliverInput,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  type PlaceOrderInput,
  type PosOrderInput,
  type Quote,
  type RazorpayCheckout,
  type RefundSource,
  type Role,
} from '@sabjiilelo/shared';
import { prisma, type Tx } from '../lib/prisma';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { ymd } from '../lib/http';
import { logger } from '../lib/logger';
import { toIssue, toRefund } from '../lib/serializers';
import { gateway } from './payments';
import { notify } from './notifier';
import { nextInvoiceNo, nextOrderNo } from './numbering';
import { slotOptions } from './slots';
import { bookSlot, releaseSlot, releaseStock, remainingByItem, reserveStock } from './stock';

export interface Actor {
  id: string;
  role: Role | 'SYSTEM';
  name: string | null;
  areaId?: string | null;
}

export const SYSTEM: Actor = { id: 'system', role: 'SYSTEM', name: 'System' };

// ---------------------------------------------------------------- includes & mapping

export const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'asc' } },
  rating: true,
  issues: { include: { orderItem: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
  slot: true,
  rider: { select: { id: true, name: true, phone: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;
export type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const orderSummaryInclude = {
  items: { select: { image: true, qty: true } },
  slot: { select: { label: true } },
  rider: { select: { name: true } },
} satisfies Prisma.OrderInclude;
type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export function toOrderSummary(o: OrderSummaryRow): OrderSummary {
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    channel: o.channel,
    paymentMode: o.paymentMode,
    paymentStatus: o.paymentStatus,
    totalPaise: o.totalPaise,
    finalPayablePaise: o.finalPayablePaise,
    slotDate: ymd(o.slotDate),
    slotLabel: o.slot?.label ?? null,
    itemCount: o.items.length,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    pincode: o.pincode,
    riderId: o.riderId,
    riderName: o.rider?.name ?? null,
    createdAt: o.createdAt.toISOString(),
    previewImages: o.items.map((i) => i.image).filter((x): x is string => !!x).slice(0, 4),
  };
}

const ISSUE_WINDOW_MS = 24 * 60 * 60 * 1000;

function customerCanCancel(o: OrderFull, now = new Date()) {
  if (!['PAYMENT_PENDING', 'PLACED', 'CONFIRMED'].includes(o.status)) return false;
  if (!o.slot || !o.slotDate) return false;
  return now < slotCutoff(ymd(o.slotDate)!, o.slot.startTime, o.slot.cutoffMinutesBefore);
}

function checkoutFor(o: OrderFull): RazorpayCheckout | null {
  if (o.status !== 'PAYMENT_PENDING') return null;
  const p = o.payments.find((x) => x.status === 'CREATED' && x.razorpayOrderId);
  if (!p) return null;
  return {
    mock: gateway.isMock,
    keyId: gateway.keyId,
    razorpayOrderId: p.razorpayOrderId!,
    amountPaise: p.amountPaise,
    currency: 'INR',
    name: 'Sabjii Le Lo',
    description: `Order ${o.orderNo}`,
    prefill: { name: o.customerName ?? '', contact: o.customerPhone ?? '' },
  };
}

export function toOrderDetail(o: OrderFull, viewer?: { id: string; role: Role }): OrderDetail {
  const isOwner = viewer?.role === 'CUSTOMER' && viewer.id === o.customerId;
  const delivered = o.status === 'DELIVERED' || o.status === 'PARTIALLY_DELIVERED';
  const addr = o.addressSnapshot as OrderDetail['address'];
  return {
    ...toOrderSummary({
      ...o,
      items: o.items.map((i) => ({ image: i.image, qty: i.qty })),
      slot: o.slot ? { label: o.slot.label } : null,
      rider: o.rider ? { name: o.rider.name } : null,
    }),
    areaId: o.areaId,
    address: addr ?? null,
    slot: o.slot ? { id: o.slot.id, label: o.slot.label, startTime: o.slot.startTime, endTime: o.slot.endTime } : null,
    subtotalPaise: o.subtotalPaise,
    discountPaise: o.discountPaise,
    deliveryFeePaise: o.deliveryFeePaise,
    couponCode: o.couponCode,
    codCollectedPaise: o.codCollectedPaise,
    invoiceNo: o.invoiceNo,
    cancelReason: o.cancelReason,
    note: o.note,
    items: o.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      variantId: i.variantId,
      name: i.name,
      variantLabel: i.variantLabel,
      unitType: i.unitType,
      baseQty: i.baseQty,
      qty: i.qty,
      packedQty: i.packedQty,
      rejectedQty: i.rejectedQty,
      rejectReason: i.rejectReason,
      rejectPhotoUrl: i.rejectPhotoUrl,
      pricePaise: i.pricePaise,
      image: i.image,
    })),
    events: o.events.map((e) => ({ id: e.id, status: e.status, note: e.note, actorName: e.actorName, createdAt: e.createdAt.toISOString() })),
    refunds: o.refunds.map((r) => toRefund(r)),
    rating: o.rating ? { stars: o.rating.stars, comment: o.rating.comment } : null,
    issues: o.issues.map((i) => toIssue(i)),
    canCancel: isOwner && customerCanCancel(o),
    canRate: isOwner && delivered && !o.rating,
    canReportIssue: isOwner && delivered && !!o.deliveredAt && Date.now() - o.deliveredAt.getTime() < ISSUE_WINDOW_MS,
    razorpay: isOwner ? checkoutFor(o) : null,
  };
}

export async function loadOrder(id: string, tx: Tx = prisma): Promise<OrderFull> {
  const o = await tx.order.findUnique({ where: { id }, include: orderInclude });
  if (!o) throw notFound('Order');
  return o;
}

async function addEvent(tx: Tx, orderId: string, status: OrderStatus, actor: Actor, note?: string | null) {
  await tx.orderEvent.create({
    data: { orderId, status, actorId: actor.id === 'system' ? null : actor.id, actorName: actor.name, note: note ?? null },
  });
}

function assertTransition(from: OrderStatus, to: OrderStatus, actor: Actor) {
  if (!canTransition(from, to, actor.role)) {
    throw new AppError(409, 'INVALID_STATUS', `Cannot move order from ${ORDER_STATUS_LABEL[from]} to ${ORDER_STATUS_LABEL[to]}`);
  }
}

// ---------------------------------------------------------------- cart & quote

async function loadCart(userId: string, areaId: string, date: string) {
  // The area's stock for the date is small, so fetch it alongside the cart instead of after it.
  const [rows, remaining] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId, variant: { item: { areaId } } },
      include: { variant: { include: { item: true } } },
      orderBy: { updatedAt: 'asc' },
    }),
    remainingByItem(areaId, date),
  ]);
  const lines: CartLine[] = rows.map((r) => {
    const v = r.variant;
    return {
      variantId: v.id,
      qty: r.qty,
      itemId: v.itemId,
      name: v.item.name,
      image: v.item.images[0] ?? null,
      unitType: v.item.unitType,
      variantLabel: v.label,
      baseQty: v.baseQty,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      available: v.isActive && v.item.isActive && (remaining.get(v.itemId) ?? 0) >= v.baseQty * r.qty,
    };
  });
  return { rows, lines };
}

async function cartLines(userId: string, areaId: string, date: string): Promise<CartLine[]> {
  return (await loadCart(userId, areaId, date)).lines;
}

export async function getCart(userId: string, areaId: string, date: string) {
  const lines = await cartLines(userId, areaId, date);
  return {
    lines,
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
    subtotalPaise: lines.reduce((s, l) => s + l.pricePaise * l.qty, 0),
  };
}

async function resolveAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId, isDeleted: false } });
  if (!address) throw notFound('Address');
  const pin = await prisma.areaPincode.findUnique({ where: { pincode: address.pincode }, include: { area: true } });
  if (!pin || !pin.area.isActive) throw badRequest('We do not deliver to this pincode yet');
  return { address, area: pin.area };
}

type CouponCheck = { coupon: Prisma.CouponGetPayload<object> | null; message: string | null };

async function checkCoupon(areaId: string, userId: string, code: string | null | undefined, subtotalPaise: number): Promise<CouponCheck> {
  if (!code) return { coupon: null, message: null };
  const today = ymdToDate(todayIST());
  const [c, mine] = await Promise.all([
    prisma.coupon.findUnique({ where: { areaId_code: { areaId, code } } }),
    prisma.couponRedemption.count({ where: { userId, coupon: { areaId, code } } }),
  ]);
  if (!c || !c.isActive || c.validFrom > today || c.validTo < today) return { coupon: null, message: 'This coupon is not valid' };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { coupon: null, message: 'This coupon has been fully used' };
  if (mine >= c.perUserLimit) return { coupon: null, message: 'You have already used this coupon' };
  if (subtotalPaise < c.minOrderPaise) return { coupon: null, message: `Add items worth ${formatINR(c.minOrderPaise - subtotalPaise)} more to use this coupon` };
  return { coupon: c, message: null };
}

export async function quote(userId: string, addressId: string, couponCode?: string | null): Promise<Quote> {
  const { area } = await resolveAddress(userId, addressId);
  const slots = await slotOptions(area.id, 3);
  const date = slots.find((s) => s.available)?.date ?? todayIST();
  const lines = await cartLines(userId, area.id, date);
  const subtotal = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const { coupon, message } = await checkCoupon(area.id, userId, couponCode, subtotal);
  const totals = computeTotals(lines, area, coupon);
  return {
    lines,
    ...totals,
    minOrderPaise: area.minOrderPaise,
    coupon: couponCode ? { code: couponCode, valid: !!coupon, message } : null,
    slots,
  };
}

// ---------------------------------------------------------------- place & pay

export async function placeOrder(customer: { id: string; name: string | null; phone: string }, input: PlaceOrderInput) {
  const { address, area } = await resolveAddress(customer.id, input.addressId);
  // Independent reads go out together: each database round trip is slow, so fewer sequential waits matters.
  const [slots, slot, cart] = await Promise.all([
    slotOptions(area.id, 3),
    prisma.deliverySlot.findUnique({ where: { id: input.slotId } }),
    loadCart(customer.id, area.id, input.slotDate),
  ]);
  const option = slots.find((x) => x.slotId === input.slotId && x.date === input.slotDate);
  if (!option || !option.available || !slot) throw badRequest('This delivery slot is no longer available. Please pick another.');

  const { rows, lines } = cart;
  if (!lines.length) throw badRequest('Your cart is empty');
  const subtotal = lines.reduce((sum, l) => sum + l.pricePaise * l.qty, 0);
  const { coupon, message } = await checkCoupon(area.id, customer.id, input.couponCode, subtotal);
  if (input.couponCode && !coupon) throw badRequest(message ?? 'Invalid coupon');
  const totals = computeTotals(lines, area, coupon);
  if (!totals.meetsMinOrder) throw badRequest(`Minimum order is ${formatINR(area.minOrderPaise)}`);

  const needs = new Map<string, { qty: number; name: string }>();
  for (const l of lines) {
    const n = needs.get(l.itemId) ?? { qty: 0, name: l.name };
    n.qty += l.baseQty * l.qty;
    needs.set(l.itemId, n);
  }
  const prepaid = input.paymentMode === 'RAZORPAY';
  const actor = { id: customer.id, name: customer.name ?? 'Customer' };

  const { order, items, event } = await prisma.$transaction(
    async (tx) => {
      await reserveStock(tx, area.id, input.slotDate, needs);
      await bookSlot(tx, slot.id, input.slotDate, slot.capacity);
      if (coupon) {
        const ok = await tx.$executeRaw`
          UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${coupon.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
        if (!ok) throw badRequest('This coupon has been fully used');
      }
      const orderNo = await nextOrderNo(tx, area.id);
      const created = await tx.order.create({
        data: {
          orderNo,
          areaId: area.id,
          customerId: customer.id,
          customerName: address.name || customer.name,
          customerPhone: address.phone || customer.phone,
          addressSnapshot: {
            name: address.name,
            phone: address.phone,
            line1: address.line1,
            landmark: address.landmark,
            city: address.city,
            pincode: address.pincode,
            lat: address.lat,
            lng: address.lng,
          },
          pincode: address.pincode,
          slotId: slot.id,
          slotDate: ymdToDate(input.slotDate),
          channel: input.channel,
          status: prepaid ? 'PAYMENT_PENDING' : 'PLACED',
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          deliveryFeePaise: totals.deliveryFeePaise,
          totalPaise: totals.totalPaise,
          finalPayablePaise: totals.totalPaise,
          paymentMode: input.paymentMode,
          paymentStatus: 'PENDING',
          couponId: coupon?.id,
          couponCode: coupon?.code,
          note: input.note,
          placedAt: prepaid ? null : new Date(),
        },
      });
      // One statement each for the lines, the timeline entry and the stock ledger.
      const itemRows = await tx.orderItem.createManyAndReturn({
        data: rows.map((r) => ({
          orderId: created.id,
          itemId: r.variant.itemId,
          variantId: r.variant.id,
          name: r.variant.item.name,
          variantLabel: r.variant.label,
          unitType: r.variant.item.unitType,
          baseQty: r.variant.baseQty,
          qty: r.qty,
          pricePaise: r.variant.pricePaise,
          gstRate: r.variant.item.gstRate,
          hsnCode: r.variant.item.hsnCode,
          image: r.variant.item.images[0] ?? null,
        })),
      });
      if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: customer.id, orderId: created.id } });
      const eventRow = await tx.orderEvent.create({ data: { orderId: created.id, status: created.status, actorId: actor.id, actorName: actor.name } });
      await tx.stockMovement.createMany({
        data: [...needs].map(([itemId, n]) => ({ areaId: area.id, itemId, type: 'SALE' as const, qty: -n.qty, refType: 'Order', refId: created.id })),
      });
      await tx.cartItem.deleteMany({ where: { userId: customer.id, variantId: { in: lines.map((l) => l.variantId) } } });
      return { order: created, items: itemRows, event: eventRow };
    },
    { timeout: 30_000 },
  );

  let payment: Prisma.PaymentGetPayload<object> | null = null;
  if (prepaid) {
    const rp = await gateway.createOrder(order.totalPaise, order.orderNo);
    payment = await prisma.payment.create({ data: { orderId: order.id, razorpayOrderId: rp.id, amountPaise: order.totalPaise } });
  } else {
    // Confirmation pushes are not part of the customer's wait.
    void notifyPlaced(order, slot.label).catch((err) => logger.warn({ err }, 'order notification failed'));
  }

  // Everything the response needs is already in hand, so skip re-reading the order.
  const full: OrderFull = { ...order, items, events: [event], refunds: [], rating: null, issues: [], slot, rider: null, payments: payment ? [payment] : [] };
  return toOrderDetail(full, { id: customer.id, role: 'CUSTOMER' });
}

type PlacedOrder = { id: string; orderNo: string; customerId: string | null; areaId: string; totalPaise: number; paymentMode: string; slotDate: Date | null };

async function notifyPlaced(o: PlacedOrder, slotLabel: string | null) {
  const [ops] = await Promise.all([
    prisma.user.findMany({ where: { areaId: o.areaId, role: { in: ['ADMIN', 'MANAGER'] }, status: 'ACTIVE' }, select: { id: true } }),
    notify([o.customerId], {
      title: 'Order placed 🎉',
      body: `${o.orderNo} will arrive ${slotLabel?.toLowerCase() ?? ''} on ${ymd(o.slotDate)}. Total ${formatINR(o.totalPaise)}.`,
      data: { orderId: o.id },
    }),
  ]);
  await notify(
    ops.map((u) => u.id),
    { title: `New order ${o.orderNo}`, body: `${formatINR(o.totalPaise)} · ${o.paymentMode} · ${slotLabel ?? ''}`, data: { orderId: o.id } },
  );
}

async function notifyOrderPlaced(orderId: string) {
  const o = await loadOrder(orderId);
  await notifyPlaced(o, o.slot?.label ?? null);
}

/** Idempotent: called by the client verify call and by the Razorpay webhook. */
export async function markPaid(razorpayOrderId: string, razorpayPaymentId: string, raw?: unknown) {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment) throw notFound('Payment');
  const changed = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'CAPTURED' } },
      data: { status: 'CAPTURED', razorpayPaymentId, raw: raw as Prisma.InputJsonValue },
    });
    if (!p.count) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (order.status === 'PAYMENT_PENDING') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'PLACED', paymentStatus: 'PAID', placedAt: new Date() } });
      await addEvent(tx, order.id, 'PLACED', SYSTEM, 'Payment received');
    } else if (order.status === 'CANCELLED') {
      // Paid after the order was auto-cancelled: give the money straight back.
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
      await tx.refund.create({
        data: { orderId: order.id, source: 'CANCEL', amountPaise: payment.amountPaise, reason: 'Payment arrived after cancellation', auto: true, status: 'APPROVED' },
      });
    } else {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    }
    return true;
  });
  if (changed) {
    const o = await loadOrder(payment.orderId);
    if (o.status === 'PLACED') await notifyOrderPlaced(o.id);
    await processApprovedRefunds(o.id);
  }
  return loadOrder(payment.orderId);
}

// ---------------------------------------------------------------- refunds

function refundedOrPending(o: { refunds: { status: string; amountPaise: number }[] }) {
  return o.refunds.filter((r) => r.status !== 'REJECTED').reduce((s, r) => s + r.amountPaise, 0);
}

/** Paid amount still held by us for a prepaid order (after any refunds already created). */
function prepaidHeld(o: { paymentStatus: string; totalPaise: number; refunds: { status: string; amountPaise: number }[] }) {
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus)) return 0;
  return Math.max(0, o.totalPaise - refundedOrPending(o));
}

async function createRefund(
  tx: Tx,
  order: { id: string; areaId: string },
  source: RefundSource,
  amountPaise: number,
  reason: string,
  autoApprove: boolean,
) {
  if (amountPaise <= 0) return null;
  return tx.refund.create({
    data: { orderId: order.id, source, amountPaise, reason, auto: autoApprove, status: autoApprove ? 'APPROVED' : 'REQUESTED' },
  });
}

/** Sends every APPROVED refund of an order to the gateway (or marks it settled for cash orders). */
export async function processApprovedRefunds(orderId: string) {
  const o = await loadOrder(orderId);
  const captured = o.payments.find((p) => p.status === 'CAPTURED' && p.razorpayPaymentId);
  for (const r of o.refunds.filter((x) => x.status === 'APPROVED')) {
    try {
      let razorpayRefundId: string | null = null;
      if (o.paymentMode === 'RAZORPAY') {
        if (!captured) continue;
        razorpayRefundId = (await gateway.refund(captured.razorpayPaymentId!, r.amountPaise, { orderNo: o.orderNo, refundId: r.id })).id;
      }
      await prisma.refund.update({ where: { id: r.id }, data: { status: 'PROCESSED', processedAt: new Date(), razorpayRefundId } });
      await notify([o.customerId], {
        title: 'Refund processed',
        body:
          o.paymentMode === 'RAZORPAY'
            ? `${formatINR(r.amountPaise)} for ${o.orderNo} is on its way to your original payment method (3-5 days).`
            : `${formatINR(r.amountPaise)} for ${o.orderNo} has been settled.`,
        data: { orderId: o.id },
      });
    } catch (err) {
      logger.error({ err, refundId: r.id }, 'refund processing failed');
    }
  }
  const fresh = await prisma.refund.findMany({ where: { orderId, status: 'PROCESSED' } });
  const done = fresh.reduce((s, r) => s + r.amountPaise, 0);
  if (done > 0 && o.paymentMode === 'RAZORPAY') {
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: done >= o.totalPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
  }
}

// ---------------------------------------------------------------- cancel

export async function cancelOrder(orderId: string, actor: Actor, reason: string) {
  const o = await loadOrder(orderId);
  if (actor.role === 'CUSTOMER') {
    if (o.customerId !== actor.id) throw forbidden();
    if (!customerCanCancel(o)) throw badRequest('The cancellation window for this slot has closed. Please contact support.');
  }
  assertTransition(o.status, 'CANCELLED', actor);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: o.id }, data: { status: 'CANCELLED', cancelReason: reason, riderId: null } });
    await addEvent(tx, o.id, 'CANCELLED', actor, reason);
    if (o.slotDate) {
      for (const it of o.items) {
        const reserved = (it.packedQty ?? it.qty) * it.baseQty;
        await releaseStock(tx, o.areaId, o.slotDate, it.itemId, reserved);
        await tx.stockMovement.create({ data: { areaId: o.areaId, itemId: it.itemId, type: 'RELEASE', qty: reserved, refType: 'Order', refId: o.id } });
      }
    }
    await releaseSlot(tx, o.slotId, o.slotDate);
    if (o.couponId) {
      await tx.couponRedemption.deleteMany({ where: { orderId: o.id } });
      await tx.coupon.update({ where: { id: o.couponId }, data: { usedCount: { decrement: 1 } } });
    }
    const held = prepaidHeld(o);
    await createRefund(tx, o, 'CANCEL', held, `Order cancelled: ${reason}`, true);
    await tx.payment.updateMany({ where: { orderId: o.id, status: 'CREATED' }, data: { status: 'FAILED' } });
  });
  await processApprovedRefunds(o.id);
  if (actor.role !== 'CUSTOMER' && actor.role !== 'SYSTEM') {
    await notify([o.customerId], { title: 'Order cancelled', body: `${o.orderNo} was cancelled: ${reason}`, data: { orderId: o.id } });
  }
  return loadOrder(o.id);
}

// ---------------------------------------------------------------- operations

export async function changeStatus(orderId: string, to: OrderStatus, actor: Actor, note?: string) {
  const o = await loadOrder(orderId);
  assertTransition(o.status, to, actor);
  // PACKED is reachable here only as "unassign rider"; packing itself goes through packOrder.
  if (to === 'PACKED' && o.status !== 'ASSIGNED') throw badRequest('Use the packing screen to mark an order packed');
  if (to === 'ASSIGNED') throw badRequest('Use dispatch to assign a rider');
  if (to === 'CANCELLED') return cancelOrder(orderId, actor, note ?? 'Cancelled by store');
  const unassign = to === 'PACKED';
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: o.id }, data: { status: to, ...(unassign ? { riderId: null } : {}) } });
    await addEvent(tx, o.id, to, actor, unassign ? note ?? 'Rider unassigned' : note);
  });
  if (to === 'CONFIRMED') {
    await notify([o.customerId], { title: 'Order confirmed', body: `We're getting ${o.orderNo} ready for you.`, data: { orderId: o.id } });
  }
  return loadOrder(o.id);
}

/** Records packed quantities. Shortages release stock, lower the bill and refund prepaid orders automatically. */
export async function packOrder(orderId: string, actor: Actor, packed: { orderItemId: string; packedQty: number }[]) {
  const o = await loadOrder(orderId);
  if (!['PLACED', 'CONFIRMED', 'PACKING'].includes(o.status)) {
    throw new AppError(409, 'INVALID_STATUS', `Cannot pack an order that is ${ORDER_STATUS_LABEL[o.status]}`);
  }
  const map = new Map(packed.map((p) => [p.orderItemId, p.packedQty]));
  const shortages: string[] = [];

  await prisma.$transaction(async (tx) => {
    let effSubtotal = 0;
    for (const it of o.items) {
      const qty = Math.min(it.qty, map.get(it.id) ?? it.qty);
      if (qty < it.qty) {
        shortages.push(`${it.name} ${it.variantLabel} × ${it.qty - qty}`);
        await releaseStock(tx, o.areaId, o.slotDate!, it.itemId, (it.qty - qty) * it.baseQty);
      }
      await tx.orderItem.update({ where: { id: it.id }, data: { packedQty: qty } });
      effSubtotal += it.pricePaise * qty;
    }
    const newFinal = finalPayable(effSubtotal, o.discountPaise, o.deliveryFeePaise);
    const invoiceNo = o.invoiceNo ?? (await nextInvoiceNo(tx, o.areaId));
    await tx.order.update({ where: { id: o.id }, data: { status: 'PACKED', finalPayablePaise: newFinal, invoiceNo } });
    await addEvent(tx, o.id, 'PACKED', actor, shortages.length ? `Short: ${shortages.join(', ')}` : null);
    const held = prepaidHeld(o);
    if (held > newFinal) await createRefund(tx, o, 'SHORTAGE', held - newFinal, `Out of stock: ${shortages.join(', ')}`, true);
  });
  await processApprovedRefunds(o.id);
  if (shortages.length) {
    await notify([o.customerId], {
      title: 'Some items were unavailable',
      body: `${shortages.join(', ')} could not be packed for ${o.orderNo}. Your bill has been reduced.`,
      data: { orderId: o.id },
    });
  }
  return loadOrder(o.id);
}

export async function dispatchOrders(areaId: string, orderIds: string[], riderId: string, actor: Actor) {
  const rider = await prisma.user.findFirst({ where: { id: riderId, areaId, role: 'DELIVERY', status: 'ACTIVE' } });
  if (!rider) throw badRequest('Choose an active delivery partner from this area');
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds }, areaId } });
  if (orders.length !== orderIds.length) throw forbidden('Some orders belong to another area');
  const notPacked = orders.filter((o) => o.status !== 'PACKED' && o.status !== 'ASSIGNED');
  if (notPacked.length) throw badRequest(`Pack these first: ${notPacked.map((o) => o.orderNo).join(', ')}`);

  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      await tx.order.update({ where: { id: o.id }, data: { status: 'ASSIGNED', riderId } });
      await addEvent(tx, o.id, 'ASSIGNED', actor, `Assigned to ${rider.name ?? rider.phone}`);
    }
  });
  await notify([riderId], {
    title: `${orders.length} new deliver${orders.length === 1 ? 'y' : 'ies'}`,
    body: orders.map((o) => o.orderNo).join(', '),
    data: { screen: 'deliveries' },
  });
  return orders.length;
}

// ---------------------------------------------------------------- delivery

export async function riderStart(orderId: string, actor: Actor) {
  const o = await loadOrder(orderId);
  if (o.riderId !== actor.id) throw forbidden('This order is not assigned to you');
  assertTransition(o.status, 'OUT_FOR_DELIVERY', actor);
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: o.id }, data: { status: 'OUT_FOR_DELIVERY' } });
    await addEvent(tx, o.id, 'OUT_FOR_DELIVERY', actor);
  });
  await notify([o.customerId], {
    title: 'Out for delivery 🚚',
    body: `${actor.name ?? 'Our delivery partner'} is on the way with ${o.orderNo}.`,
    data: { orderId: o.id },
  });
  return loadOrder(o.id);
}

/**
 * Doorstep handover: the freshness promise. Rejected items come off the bill on the spot.
 * COD customers simply pay less; prepaid customers get a refund, instant up to the area limit.
 */
export async function riderDeliver(orderId: string, actor: Actor, input: DeliverInput) {
  const o = await loadOrder(orderId);
  if (o.riderId !== actor.id) throw forbidden('This order is not assigned to you');
  if (o.status !== 'OUT_FOR_DELIVERY') throw new AppError(409, 'INVALID_STATUS', 'Start the delivery first');
  const area = await prisma.area.findUniqueOrThrow({ where: { id: o.areaId } });

  const rejections = new Map(input.rejections.map((r) => [r.orderItemId, r]));
  for (const r of input.rejections) {
    const it = o.items.find((x) => x.id === r.orderItemId);
    if (!it) throw badRequest('Unknown item in rejection list');
    if (r.qty > (it.packedQty ?? it.qty)) throw badRequest(`Cannot reject more ${it.name} than was delivered`);
  }

  let effSubtotal = 0;
  for (const it of o.items) {
    const rej = rejections.get(it.id)?.qty ?? 0;
    effSubtotal += it.pricePaise * Math.max(0, (it.packedQty ?? it.qty) - rej);
  }
  const newFinal = finalPayable(effSubtotal, o.discountPaise, o.deliveryFeePaise);
  const status: OrderStatus = input.rejections.length ? 'PARTIALLY_DELIVERED' : 'DELIVERED';
  const isCod = o.paymentMode === 'COD';
  const collected = isCod ? input.codCollectedPaise ?? newFinal : null;
  const held = prepaidHeld(o);
  const refundAmount = isCod ? 0 : Math.max(0, held - newFinal);
  const autoRefund = refundAmount <= area.autoRefundLimitPaise;
  const rejectedText = input.rejections
    .map((r) => `${o.items.find((i) => i.id === r.orderItemId)!.name} × ${r.qty} (${r.reason})`)
    .join(', ');

  await prisma.$transaction(async (tx) => {
    for (const r of input.rejections) {
      await tx.orderItem.update({
        where: { id: r.orderItemId },
        data: { rejectedQty: r.qty, rejectReason: r.reason, rejectPhotoUrl: r.photoUrl ?? null },
      });
    }
    await tx.order.update({
      where: { id: o.id },
      data: {
        status,
        finalPayablePaise: newFinal,
        deliveredAt: new Date(),
        codCollectedPaise: collected,
        paymentStatus: isCod ? 'PAID' : undefined,
      },
    });
    await addEvent(tx, o.id, status, actor, rejectedText ? `Returned at door: ${rejectedText}` : null);
    if (refundAmount > 0) await createRefund(tx, o, 'DOORSTEP', refundAmount, `Returned at door: ${rejectedText}`, autoRefund);
    if (isCod && collected) {
      const today = ymdToDate(todayIST());
      await tx.riderCashDay.upsert({
        where: { riderId_date: { riderId: actor.id, date: today } },
        update: { codExpectedPaise: { increment: collected }, status: 'OPEN' },
        create: { riderId: actor.id, areaId: o.areaId, date: today, codExpectedPaise: collected },
      });
    }
  });
  await processApprovedRefunds(o.id);
  await notify([o.customerId], {
    title: status === 'DELIVERED' ? 'Delivered ✅' : 'Delivered with returns',
    body:
      status === 'DELIVERED'
        ? `${o.orderNo} has been delivered. Enjoy your fresh produce!`
        : `${o.orderNo} delivered. Returned: ${rejectedText}. ${isCod ? `You paid ${formatINR(collected ?? 0)}.` : refundAmount ? `${formatINR(refundAmount)} will be refunded.` : ''}`,
    data: { orderId: o.id },
  });
  return loadOrder(o.id);
}

// ---------------------------------------------------------------- after delivery

export async function rateOrder(orderId: string, userId: string, stars: number, comment?: string) {
  const o = await loadOrder(orderId);
  if (o.customerId !== userId) throw forbidden();
  if (!['DELIVERED', 'PARTIALLY_DELIVERED'].includes(o.status)) throw badRequest('You can rate an order after it is delivered');
  await prisma.rating.upsert({ where: { orderId }, update: { stars, comment }, create: { orderId, userId, stars, comment } });
  return loadOrder(orderId);
}

export async function reportIssue(
  orderId: string,
  userId: string,
  input: { orderItemId?: string; type: Prisma.IssueReportCreateInput['type']; description?: string; photoUrl?: string },
) {
  const o = await loadOrder(orderId);
  if (o.customerId !== userId) throw forbidden();
  if (!o.deliveredAt || Date.now() - o.deliveredAt.getTime() > ISSUE_WINDOW_MS) {
    throw badRequest('Issues can be reported within 24 hours of delivery');
  }
  if (input.orderItemId && !o.items.some((i) => i.id === input.orderItemId)) throw badRequest('Unknown item');
  await prisma.issueReport.create({ data: { orderId, userId, ...input } });
  const accountants = await prisma.user.findMany({ where: { areaId: o.areaId, role: { in: ['ACCOUNTANT', 'ADMIN'] }, status: 'ACTIVE' }, select: { id: true } });
  await notify(
    accountants.map((a) => a.id),
    { title: `Issue reported on ${o.orderNo}`, body: input.description ?? input.type, data: { orderId } },
  );
  return loadOrder(orderId);
}

export async function decideRefund(refundId: string, actor: Actor, approve: boolean, note?: string) {
  const r = await prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
  if (!r) throw notFound('Refund');
  if (actor.areaId && r.order.areaId !== actor.areaId) throw forbidden('This belongs to another area');
  if (r.status !== 'REQUESTED') throw badRequest('This refund has already been decided');
  await prisma.refund.update({
    where: { id: r.id },
    data: { status: approve ? 'APPROVED' : 'REJECTED', approvedById: actor.id, approvedByName: actor.name, decisionNote: note },
  });
  if (approve) await processApprovedRefunds(r.orderId);
  else await notify([r.order.customerId], { title: 'Refund update', body: `Your refund request for ${r.order.orderNo} was declined. ${note ?? ''}`, data: { orderId: r.orderId } });
  return prisma.refund.findUniqueOrThrow({ where: { id: r.id }, include: { order: true } });
}

export async function resolveIssue(issueId: string, actor: Actor, approve: boolean, refundPaise: number | undefined, note?: string) {
  const issue = await prisma.issueReport.findUnique({ where: { id: issueId }, include: { order: { include: { refunds: true } }, orderItem: true } });
  if (!issue) throw notFound('Issue');
  if (actor.areaId && issue.order.areaId !== actor.areaId) throw forbidden('This belongs to another area');
  if (issue.status !== 'OPEN') throw badRequest('This issue is already resolved');

  if (!approve) {
    await prisma.issueReport.update({ where: { id: issue.id }, data: { status: 'REJECTED', decisionNote: note } });
    await notify([issue.order.customerId], { title: 'Issue reviewed', body: `We reviewed your report on ${issue.order.orderNo}. ${note ?? ''}`, data: { orderId: issue.orderId } });
    return;
  }
  const o = issue.order;
  const maxRefundable = Math.max(0, (o.paymentMode === 'COD' ? o.codCollectedPaise ?? 0 : o.totalPaise) - refundedOrPending(o));
  const suggested = issue.orderItem ? issue.orderItem.pricePaise * effectiveLineQty(issue.orderItem) : 0;
  const amount = Math.min(maxRefundable, refundPaise ?? suggested);
  await prisma.$transaction(async (tx) => {
    const refund = await createRefund(tx, o, 'ISSUE', amount, `Issue: ${issue.type}${issue.description ? ` – ${issue.description}` : ''}`, true);
    if (refund) await tx.refund.update({ where: { id: refund.id }, data: { approvedById: actor.id, approvedByName: actor.name, decisionNote: note } });
    await tx.issueReport.update({ where: { id: issue.id }, data: { status: 'APPROVED', decisionNote: note, refundId: refund?.id } });
  });
  await processApprovedRefunds(o.id);
}

// ---------------------------------------------------------------- counter sale

export async function posOrder(areaId: string, actor: Actor, input: PosOrderInput) {
  const variants = await prisma.itemVariant.findMany({
    where: { id: { in: input.items.map((i) => i.variantId) }, isActive: true, item: { areaId, isActive: true } },
    include: { item: true },
  });
  if (variants.length !== new Set(input.items.map((i) => i.variantId)).size) throw badRequest('Some items are not available');
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines = input.items.map((i) => ({ ...i, v: byId.get(i.variantId)! }));
  const subtotal = lines.reduce((s, l) => s + l.v.pricePaise * l.qty, 0);
  const discount = Math.min(input.discountPaise, subtotal);
  const total = subtotal - discount;
  const today = todayIST();

  const stocked = new Set(
    (await prisma.dailyStock.findMany({ where: { areaId, date: ymdToDate(today), itemId: { in: variants.map((v) => v.itemId) } } })).map(
      (r) => r.itemId,
    ),
  );
  const needs = new Map<string, { qty: number; name: string }>();
  for (const l of lines) {
    if (!stocked.has(l.v.itemId)) continue; // counter stock that was never put on the online board
    const n = needs.get(l.v.itemId) ?? { qty: 0, name: l.v.item.name };
    n.qty += l.v.baseQty * l.qty;
    needs.set(l.v.itemId, n);
  }

  const order = await prisma.$transaction(async (tx) => {
    await reserveStock(tx, areaId, today, needs);
    const customer = input.customerPhone ? await tx.user.findUnique({ where: { phone: input.customerPhone } }) : null;
    const created = await tx.order.create({
      data: {
        orderNo: await nextOrderNo(tx, areaId),
        invoiceNo: await nextInvoiceNo(tx, areaId),
        areaId,
        customerId: customer?.role === 'CUSTOMER' ? customer.id : null,
        customerName: input.customerName || customer?.name || null,
        customerPhone: input.customerPhone || null,
        slotDate: ymdToDate(today),
        channel: 'POS',
        status: 'DELIVERED',
        subtotalPaise: subtotal,
        discountPaise: discount,
        deliveryFeePaise: 0,
        totalPaise: total,
        finalPayablePaise: total,
        paymentMode: input.paymentMode,
        paymentStatus: 'PAID',
        placedAt: new Date(),
        deliveredAt: new Date(),
        items: {
          create: lines.map((l) => ({
            itemId: l.v.itemId,
            variantId: l.v.id,
            name: l.v.item.name,
            variantLabel: l.v.label,
            unitType: l.v.item.unitType,
            baseQty: l.v.baseQty,
            qty: l.qty,
            packedQty: l.qty,
            pricePaise: l.v.pricePaise,
            gstRate: l.v.item.gstRate,
            hsnCode: l.v.item.hsnCode,
            image: l.v.item.images[0] ?? null,
          })),
        },
      },
    });
    await addEvent(tx, created.id, 'DELIVERED', actor, `Counter sale · ${input.paymentMode}`);
    for (const l of lines) {
      await tx.stockMovement.create({
        data: { areaId, itemId: l.v.itemId, type: 'SALE', qty: -l.v.baseQty * l.qty, refType: 'POS', refId: created.id, actorId: actor.id },
      });
    }
    return created;
  });
  return loadOrder(order.id);
}

// ---------------------------------------------------------------- housekeeping

/** Cancels prepaid orders that were never paid, releasing their stock and slot. */
export async function expireUnpaidOrders(olderThanMin = 15) {
  const stale = await prisma.order.findMany({
    where: { status: 'PAYMENT_PENDING', createdAt: { lt: new Date(Date.now() - olderThanMin * 60_000) } },
    select: { id: true },
  });
  for (const o of stale) {
    try {
      await cancelOrder(o.id, SYSTEM, 'Payment not completed');
    } catch (err) {
      logger.warn({ err, orderId: o.id }, 'failed to expire unpaid order');
    }
  }
  return stale.length;
}
