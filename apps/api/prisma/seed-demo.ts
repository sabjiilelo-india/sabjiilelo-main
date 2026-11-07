/**
 * Demo history so every dashboard, report and queue has something to show:
 * customers, ~150 orders over the last 10 days (every status), ratings, refunds, customer issues,
 * rider cash, and vendor purchase orders with payables and payments.
 *
 *   pnpm db:seed:demo            add it (does nothing if it is already there)
 *   pnpm db:seed:demo -- --reset remove the demo data and add it again
 *
 * Everything it creates is tagged (orders/POs with note "DEMO", customers with phones 98000xxxxx),
 * so real data is never touched. Run `pnpm db:seed` first for areas, staff and the catalog.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma, type OrderStatus, type PaymentMode } from '@prisma/client';
import { addDays, costPaise, financialYear, finalPayable, istInstant, todayIST, ymdToDate } from '@sabjiilelo/shared';

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');
const TAG = 'DEMO';

// small deterministic random generator: the same data every run
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(20261107);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const chance = (p: number) => rnd() < p;
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const FIRST = ['Aarav', 'Anjali', 'Rohit', 'Neha', 'Vikram', 'Pooja', 'Amit', 'Sneha', 'Rahul', 'Kavita', 'Sandeep', 'Meera', 'Arjun', 'Divya', 'Manish', 'Ritu', 'Karan', 'Shweta'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Tiwari', 'Dubey', 'Jain', 'Gupta', 'Yadav', 'Mishra', 'Singh', 'Chourasia', 'Soni'];
const STREETS = ['Napier Town', 'Wright Town', 'Civil Lines', 'Vijay Nagar', 'Ranjhi', 'Madan Mahal', 'Gorakhpur', 'Adhartal', 'Sadar Bazaar', 'Tilwara Road'];
const LANDMARKS = ['Near City Hospital', 'Opp. Bhawartal Garden', 'Behind SBI Bank', 'Near Shiv Mandir', 'Opp. Govt School', 'Near Water Tank'];
const COMMENTS = ['Super fresh, loved it!', 'Vegetables were very fresh', 'On time delivery', 'Good quality, will order again', 'Delivery partner was polite', 'Tomatoes were a bit soft', 'Great packing'];
const REJECT = ['Not fresh', 'Damaged', 'Short weight'];

type Stage = 'PLACED' | 'CONFIRMED' | 'PACKING' | 'PACKED' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
const FLOW: Stage[] = ['PLACED', 'CONFIRMED', 'PACKING', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

async function wipe() {
  const demoOrders = await prisma.order.findMany({ where: { note: TAG }, select: { id: true } });
  const ids = demoOrders.map((o) => o.id);
  await prisma.issueReport.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.refund.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } }); // cascades items, events, payments, ratings
  await prisma.vendorLedger.deleteMany({ where: { note: { startsWith: TAG } } });
  await prisma.purchaseOrder.deleteMany({ where: { note: TAG } });
  await prisma.riderCashDay.deleteMany({ where: { note: TAG } });
  const customers = await prisma.user.findMany({ where: { phone: { startsWith: '98000' } }, select: { id: true } });
  await prisma.address.deleteMany({ where: { userId: { in: customers.map((c) => c.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: customers.map((c) => c.id) } } });
  console.log(`removed ${ids.length} demo orders and ${customers.length} demo customers`);
}

async function main() {
  if (RESET) await wipe();
  else if (await prisma.order.count({ where: { note: TAG } })) {
    console.log('Demo data is already there. Run with -- --reset to rebuild it.');
    return;
  }

  const today = todayIST();
  const now = new Date();
  const fy = financialYear(today);
  const areas = await prisma.area.findMany({ where: { code: { in: ['JBP', 'SAT'] } }, include: { slots: { orderBy: { sort: 'asc' } }, pincodes: true } });
  if (areas.length < 2) throw new Error('Run `pnpm db:seed` first (areas JBP and SAT are missing).');

  // ---------- accumulators ----------
  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const events: Prisma.OrderEventCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const refunds: Prisma.RefundCreateManyInput[] = [];
  const ratings: Prisma.RatingCreateManyInput[] = [];
  const issues: Prisma.IssueReportCreateManyInput[] = [];
  const cash = new Map<string, { riderId: string; areaId: string; date: string; expected: number }>();
  const reserve = new Map<string, Map<string, number>>(); // date -> itemId -> base qty for orders still in progress
  const slotUse = new Map<string, number>(); // slotId|date -> orders
  const counters = new Map<string, { order: number; invoice: number; po: number }>();

  for (const area of areas) {
    const staff = await prisma.user.findMany({ where: { areaId: area.id, status: 'ACTIVE' } });
    const riders = staff.filter((u) => u.role === 'DELIVERY');
    const manager = staff.find((u) => u.role === 'MANAGER');
    const accountant = staff.find((u) => u.role === 'ACCOUNTANT');
    const catalog = await prisma.item.findMany({ where: { areaId: area.id, isActive: true }, include: { variants: { where: { isActive: true }, orderBy: { baseQty: 'asc' } } } });
    if (!catalog.length) throw new Error(`${area.code} has no items; run pnpm db:seed first`);
    const slots = area.slots;
    const pins = area.pincodes.map((p) => p.pincode);
    const isJbp = area.code === 'JBP';
    const c = { order: area.orderSeq, invoice: area.invoiceFy === fy ? area.invoiceSeq : 0, po: area.poSeq };
    counters.set(area.id, c);

    // ---------- customers ----------
    const n = isJbp ? 14 : 5;
    const base = isJbp ? 1 : 100;
    const customers = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      phone: `98000${String(base + i).padStart(5, '0')}`,
      name: `${FIRST[(i * 5 + base) % FIRST.length]} ${LAST[(i * 3 + base) % LAST.length]}`,
    }));
    await prisma.user.createMany({ data: customers.map((u) => ({ id: u.id, phone: u.phone, name: u.name, role: 'CUSTOMER' as const })), skipDuplicates: true });
    const stored = await prisma.user.findMany({ where: { phone: { in: customers.map((u) => u.phone) } } });
    const addr = new Map<string, Prisma.AddressCreateManyInput>();
    for (const u of stored) {
      const pin = pick(pins);
      addr.set(u.id, {
        id: randomUUID(),
        userId: u.id,
        label: 'Home',
        name: u.name ?? 'Customer',
        phone: u.phone,
        line1: `${int(2, 240)}, ${pick(STREETS)}`,
        landmark: pick(LANDMARKS),
        city: area.city,
        pincode: pin,
        areaId: area.id,
        isDefault: true,
      });
    }
    await prisma.address.createMany({ data: [...addr.values()] });

    // ---------- order generator ----------
    type Spec = {
      day: number;
      slot: number;
      status: OrderStatus;
      mode: PaymentMode;
      forced?: { name: string; label: string; qty: number }[];
      rejectIdx?: { idx: number; qty: number };
      shortIdx?: number;
      refundPending?: boolean;
      rated?: boolean;
    };

    const make = (spec: Spec) => {
      const cust = pick(stored);
      const a = addr.get(cust.id)!;
      const slot = slots[spec.slot % slots.length]!;
      const date = addDays(today, spec.day);
      const slotStart = istInstant(date, slot.startTime);
      const created = new Date(istInstant(addDays(date, -1), '18:00').getTime() + int(0, 5 * 60) * 60_000);
      const id = randomUUID();
      c.order += 1;
      const orderNo = `${area.code}${String(c.order).padStart(6, '0')}`;

      const picks = (spec.forced
        ? spec.forced.map((f) => {
            const it = catalog.find((x) => x.name === f.name) ?? catalog[0]!;
            return { item: it, variant: it.variants.find((v) => v.label === f.label) ?? it.variants[0]!, qty: f.qty };
          })
        : [...catalog].sort(() => rnd() - 0.5).slice(0, int(2, 5)).map((it) => ({ item: it, variant: pick(it.variants), qty: int(1, 3) }))
      ).filter((p) => p.variant);

      const cancelled = spec.status === 'CANCELLED';
      const stageIdx = cancelled ? 1 : FLOW.indexOf(spec.status === 'PARTIALLY_DELIVERED' ? 'DELIVERED' : (spec.status as Stage));
      const reachedPacked = !cancelled && stageIdx >= FLOW.indexOf('PACKED');
      const delivered = spec.status === 'DELIVERED' || spec.status === 'PARTIALLY_DELIVERED';
      const rider = !cancelled && stageIdx >= FLOW.indexOf('ASSIGNED') ? riders[(c.order + (isJbp ? 0 : 1)) % Math.max(1, riders.length)] : undefined;

      const lines = picks.map((p, i) => {
        const packedQty = reachedPacked ? (spec.shortIdx === i ? Math.max(0, p.qty - 1) : p.qty) : null;
        const rejectedQty = delivered && spec.rejectIdx?.idx === i ? Math.min(spec.rejectIdx.qty, packedQty ?? p.qty) : 0;
        return { p, id: randomUUID(), packedQty, rejectedQty, i };
      });
      const subtotal = picks.reduce((s, p) => s + p.variant.pricePaise * p.qty, 0);
      const fee = subtotal >= area.freeDeliveryAbovePaise ? 0 : area.deliveryFeePaise;
      const useCoupon = subtotal >= 19900 && chance(0.2);
      const discount = useCoupon ? 5000 : 0;
      const total = subtotal - discount + fee;
      const eff = lines.reduce((s, l) => s + l.p.variant.pricePaise * Math.max(0, (l.packedQty ?? l.p.qty) - l.rejectedQty), 0);
      const finalPay = reachedPacked || delivered ? finalPayable(eff, discount, fee) : total;
      const prepaid = spec.mode === 'RAZORPAY';
      const deliveredAt = delivered ? new Date(slotStart.getTime() + int(20, 90) * 60_000) : null;

      let invoiceNo: string | null = null;
      if (reachedPacked) {
        c.invoice += 1;
        invoiceNo = `${area.code}/${fy}/${String(c.invoice).padStart(5, '0')}`;
      }

      // timeline
      const when: Record<Stage, Date> = {
        PLACED: created,
        CONFIRMED: new Date(created.getTime() + int(8, 40) * 60_000),
        PACKING: new Date(slotStart.getTime() - 3 * 3_600_000),
        PACKED: new Date(slotStart.getTime() - 2 * 3_600_000),
        ASSIGNED: new Date(slotStart.getTime() - 90 * 60_000),
        OUT_FOR_DELIVERY: slotStart,
        DELIVERED: deliveredAt ?? slotStart,
      };
      const clamp = (d: Date) => (d > now ? new Date(now.getTime() - int(2, 30) * 60_000) : d);
      const actors: Record<string, string> = { PLACED: 'Customer', CONFIRMED: manager?.name ?? 'Manager', PACKING: manager?.name ?? 'Manager', PACKED: manager?.name ?? 'Manager', ASSIGNED: manager?.name ?? 'Manager', OUT_FOR_DELIVERY: rider?.name ?? 'Rider', DELIVERED: rider?.name ?? 'Rider' };
      const evStages: Stage[] = cancelled ? ['PLACED'] : FLOW.slice(0, stageIdx + 1);
      for (const st of evStages) {
        const final = st === 'DELIVERED' && spec.status === 'PARTIALLY_DELIVERED';
        events.push({
          id: randomUUID(),
          orderId: id,
          status: final ? 'PARTIALLY_DELIVERED' : st,
          actorName: actors[st],
          note: st === 'ASSIGNED' ? `Assigned to ${rider?.name}` : final ? 'Returned at door' : null,
          createdAt: clamp(when[st]),
        });
      }
      if (cancelled) events.push({ id: randomUUID(), orderId: id, status: 'CANCELLED', actorName: 'Customer', note: 'Changed plans', createdAt: new Date(created.getTime() + int(20, 120) * 60_000) });

      orders.push({
        id,
        orderNo,
        areaId: area.id,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        addressSnapshot: { name: a.name, phone: a.phone, line1: a.line1, landmark: a.landmark ?? null, city: a.city, pincode: a.pincode, lat: null, lng: null },
        pincode: a.pincode,
        slotId: slot.id,
        slotDate: ymdToDate(date),
        channel: chance(0.7) ? 'APP' : 'WEB',
        status: spec.status,
        subtotalPaise: subtotal,
        discountPaise: discount,
        deliveryFeePaise: fee,
        totalPaise: total,
        finalPayablePaise: cancelled ? total : finalPay,
        paymentMode: spec.mode,
        paymentStatus: cancelled ? (prepaid ? 'REFUNDED' : 'PENDING') : prepaid ? (spec.rejectIdx ? 'PARTIALLY_REFUNDED' : 'PAID') : delivered ? 'PAID' : 'PENDING',
        couponCode: useCoupon ? 'WELCOME50' : null,
        riderId: rider?.id ?? null,
        codCollectedPaise: !prepaid && delivered ? finalPay : null,
        invoiceNo,
        cancelReason: cancelled ? 'Changed plans' : null,
        note: TAG,
        placedAt: created,
        deliveredAt,
        createdAt: created,
      });
      for (const l of lines) {
        items.push({
          id: l.id,
          orderId: id,
          itemId: l.p.item.id,
          variantId: l.p.variant.id,
          name: l.p.item.name,
          variantLabel: l.p.variant.label,
          unitType: l.p.item.unitType,
          baseQty: l.p.variant.baseQty,
          qty: l.p.qty,
          packedQty: l.packedQty,
          rejectedQty: l.rejectedQty,
          rejectReason: l.rejectedQty ? pick(REJECT) : null,
          pricePaise: l.p.variant.pricePaise,
          gstRate: l.p.item.gstRate,
          hsnCode: l.p.item.hsnCode,
          image: l.p.item.images[0] ?? null,
        });
      }
      if (prepaid && !cancelled) {
        payments.push({ id: randomUUID(), orderId: id, razorpayOrderId: `order_demo_${id.slice(0, 14)}`, razorpayPaymentId: `pay_demo_${id.slice(0, 14)}`, amountPaise: total, status: 'CAPTURED' });
      }
      if (cancelled && prepaid) {
        payments.push({ id: randomUUID(), orderId: id, razorpayOrderId: `order_demo_${id.slice(0, 14)}`, razorpayPaymentId: `pay_demo_${id.slice(0, 14)}`, amountPaise: total, status: 'CAPTURED' });
        refunds.push({ id: randomUUID(), orderId: id, source: 'CANCEL', amountPaise: total, reason: 'Order cancelled: Changed plans', status: 'PROCESSED', auto: true, processedAt: new Date(created.getTime() + 3 * 3_600_000), createdAt: created });
      }
      // doorstep return refunds for prepaid orders
      const rejected = lines.filter((l) => l.rejectedQty > 0);
      if (rejected.length && prepaid) {
        const amount = rejected.reduce((s, l) => s + l.rejectedQty * l.p.variant.pricePaise, 0);
        const pending = !!spec.refundPending || amount > area.autoRefundLimitPaise;
        refunds.push({
          id: randomUUID(),
          orderId: id,
          source: 'DOORSTEP',
          amountPaise: amount,
          reason: `Returned at door: ${rejected.map((l) => `${l.p.item.name} × ${l.rejectedQty}`).join(', ')}`,
          status: pending ? 'REQUESTED' : 'PROCESSED',
          auto: !pending,
          approvedByName: pending ? null : null,
          processedAt: pending ? null : deliveredAt,
          createdAt: deliveredAt ?? created,
        });
      }
      // ratings
      if (delivered && (spec.rated ?? chance(0.7))) {
        const stars = pick([5, 5, 5, 4, 4, 4, 3, 5, 2]);
        ratings.push({ id: randomUUID(), orderId: id, userId: cust.id, stars, comment: chance(0.6) ? pick(COMMENTS) : null, createdAt: new Date((deliveredAt ?? now).getTime() + int(10, 600) * 60_000) });
      }
      // rider cash (COD collected)
      if (rider && !prepaid && delivered) {
        const key = `${rider.id}|${date}`;
        const cur = cash.get(key) ?? { riderId: rider.id, areaId: area.id, date, expected: 0 };
        cur.expected += finalPay;
        cash.set(key, cur);
      }
      // stock and slot capacity held by orders still in progress
      if (!cancelled && !delivered && spec.day >= 0) {
        const m = reserve.get(date) ?? new Map<string, number>();
        for (const l of lines) m.set(l.p.item.id, (m.get(l.p.item.id) ?? 0) + l.p.variant.baseQty * l.p.qty);
        reserve.set(date, m);
        slotUse.set(`${slot.id}|${date}`, (slotUse.get(`${slot.id}|${date}`) ?? 0) + 1);
      }
      return { id, lines, cust };
    };

    // ---------- the last 10 days: mostly delivered, a few returns and cancellations ----------
    const perDay = isJbp ? [4, 6] : [2, 3];
    for (let day = -9; day <= -1; day++) {
      const count = int(perDay[0]!, perDay[1]!);
      for (let k = 0; k < count; k++) {
        const r = rnd();
        const status: OrderStatus = r < 0.06 ? 'CANCELLED' : r < 0.14 ? 'PARTIALLY_DELIVERED' : 'DELIVERED';
        const mode: PaymentMode = chance(0.48) ? 'RAZORPAY' : 'COD';
        make({
          day,
          slot: k % 2,
          status,
          mode,
          rejectIdx: status === 'PARTIALLY_DELIVERED' ? { idx: 0, qty: 1 } : undefined,
          shortIdx: status === 'DELIVERED' && chance(0.08) ? 0 : undefined,
        });
      }
    }

    if (isJbp) {
      // a prepaid return big enough to need the accountant (above the instant-refund limit)
      make({
        day: -1,
        slot: 0,
        status: 'PARTIALLY_DELIVERED',
        mode: 'RAZORPAY',
        forced: [{ name: 'Apple (Shimla)', label: '1 kg', qty: 3 }, { name: 'Banana (Robusta)', label: '1 dozen', qty: 1 }],
        rejectIdx: { idx: 0, qty: 2 },
        refundPending: true,
        rated: false,
      });
      // today: every stage a store sees during the day
      const todayStages: [OrderStatus, number, PaymentMode][] = [
        ['DELIVERED', 0, 'COD'],
        ['DELIVERED', 0, 'RAZORPAY'],
        ['OUT_FOR_DELIVERY', 0, 'COD'],
        ['OUT_FOR_DELIVERY', 1, 'RAZORPAY'],
        ['ASSIGNED', 1, 'COD'],
        ['PACKED', 1, 'RAZORPAY'],
        ['PACKING', 1, 'COD'],
        ['CONFIRMED', 1, 'RAZORPAY'],
        ['PLACED', 1, 'COD'],
        ['PLACED', 1, 'COD'],
      ];
      for (const [status, slot, mode] of todayStages) make({ day: 0, slot, status, mode });
      // tomorrow: new orders waiting for the store
      for (let k = 0; k < 7; k++) make({ day: 1, slot: k % 2, status: k < 5 ? 'PLACED' : 'CONFIRMED', mode: k % 3 === 0 ? 'RAZORPAY' : 'COD' });
    } else {
      make({ day: 0, slot: 0, status: 'DELIVERED', mode: 'COD' });
      make({ day: 1, slot: 0, status: 'PLACED', mode: 'COD' });
      make({ day: 1, slot: 1, status: 'CONFIRMED', mode: 'RAZORPAY' });
    }

    // ---------- vendor purchase orders and payables (Jabalpur) ----------
    if (isJbp && manager) {
      const vendors = await prisma.vendor.findMany({ where: { areaId: area.id }, orderBy: { businessName: 'asc' } });
      const poRows: Prisma.PurchaseOrderCreateManyInput[] = [];
      const poItems: Prisma.PoItemCreateManyInput[] = [];
      const ledger: Prisma.VendorLedgerCreateManyInput[] = [];
      for (let day = -6; day <= 1; day++) {
        const vendor = vendors[(day + 10) % Math.max(1, vendors.length)];
        if (!vendor) continue;
        const date = addDays(today, day);
        const status = day < 0 ? 'RECEIVED' : day === 0 ? 'ACCEPTED' : 'SENT';
        c.po += 1;
        const poId = randomUUID();
        const chosen = [...catalog].sort(() => rnd() - 0.5).slice(0, 6);
        let total = 0;
        for (const it of chosen) {
          const v0 = it.variants[0]!;
          const perRateUnit = ['KG', 'GRAM', 'LITRE'].includes(it.unitType) ? (v0.pricePaise * 1000) / v0.baseQty : v0.pricePaise / v0.baseQty;
          const rate = Math.round(perRateUnit * (0.6 + rnd() * 0.08));
          const ordered = ['KG', 'GRAM', 'LITRE'].includes(it.unitType) ? int(10, 40) * 1000 : int(30, 120);
          const accepted = status === 'SENT' ? null : chance(0.2) ? Math.round(ordered * 0.9) : ordered;
          const received = status === 'RECEIVED' ? (accepted ?? ordered) - (chance(0.15) ? Math.round(ordered * 0.05) : 0) : null;
          poItems.push({ id: randomUUID(), poId, itemId: it.id, orderedQty: ordered, acceptedQty: accepted, receivedQty: received, ratePaise: rate });
          if (received) total += costPaise(it.unitType, received, rate);
        }
        poRows.push({ id: poId, poNo: `PO-${area.code}-${String(c.po).padStart(5, '0')}`, areaId: area.id, vendorId: vendor.id, forDate: ymdToDate(date), status, note: TAG, createdById: manager.id, createdAt: istInstant(addDays(date, -1), '17:30') });
        if (status === 'RECEIVED' && total > 0) {
          ledger.push({ id: randomUUID(), vendorId: vendor.id, areaId: area.id, type: 'PAYABLE', amountPaise: total, poId, note: `${TAG} goods received`, actorId: manager.id, createdAt: istInstant(date, '06:30') });
          // older purchases are paid; the two most recent stay outstanding (one part-paid)
          if (day <= -3) ledger.push({ id: randomUUID(), vendorId: vendor.id, areaId: area.id, type: 'PAYMENT', amountPaise: total, reference: `UTR${int(100000, 999999)}${int(1000, 9999)}`, note: `${TAG} payment`, actorId: accountant?.id, createdAt: istInstant(addDays(date, 2), '12:00') });
          else if (day === -2) ledger.push({ id: randomUUID(), vendorId: vendor.id, areaId: area.id, type: 'PAYMENT', amountPaise: Math.round(total * 0.5), reference: `UTR${int(100000, 999999)}${int(1000, 9999)}`, note: `${TAG} part payment`, actorId: accountant?.id, createdAt: istInstant(addDays(date, 1), '12:00') });
        }
      }
      await prisma.purchaseOrder.createMany({ data: poRows });
      await prisma.poItem.createMany({ data: poItems });
      await prisma.vendorLedger.createMany({ data: ledger });
      console.log(`  ${area.code}: ${poRows.length} purchase orders, ${ledger.length} ledger entries`);
    }
  }

  // ---------- customer issues on a few delivered orders ----------
  const deliveredJbp = orders.filter((o) => o.status === 'DELIVERED' && String(o.orderNo).startsWith('JBP'));
  const recent = deliveredJbp.slice(-6);
  const itemFor = (orderId: string) => items.find((i) => i.orderId === orderId)!;
  const issueDefs: { o: (typeof recent)[number]; type: 'DAMAGED' | 'QUALITY' | 'MISSING'; status: 'OPEN' | 'APPROVED' | 'REJECTED'; text: string }[] = [
    { o: recent[0]!, type: 'DAMAGED', status: 'OPEN', text: 'Two pieces were crushed in the bag' },
    { o: recent[1]!, type: 'QUALITY', status: 'OPEN', text: 'Leaves were wilted' },
    { o: recent[2]!, type: 'MISSING', status: 'APPROVED', text: 'One item missing from my order' },
    { o: recent[3]!, type: 'QUALITY', status: 'REJECTED', text: 'Not as fresh as I expected' },
  ];
  for (const d of issueDefs) {
    if (!d.o) continue;
    const it = itemFor(d.o.id as string);
    let refundId: string | null = null;
    if (d.status === 'APPROVED') {
      refundId = randomUUID();
      refunds.push({ id: refundId, orderId: d.o.id as string, source: 'ISSUE', amountPaise: it.pricePaise * it.qty, reason: `Issue: ${d.type} – ${d.text}`, status: 'PROCESSED', auto: true, approvedByName: 'Pooja (Accountant)', processedAt: new Date(), createdAt: new Date() });
    }
    issues.push({ id: randomUUID(), orderId: d.o.id as string, orderItemId: it.id as string, userId: d.o.customerId as string, type: d.type, description: d.text, status: d.status, refundId, decisionNote: d.status === 'REJECTED' ? 'Photo shows normal produce' : null, createdAt: new Date(Date.now() - int(1, 20) * 3_600_000) });
  }

  // ---------- write everything (a handful of bulk inserts) ----------
  const chunk = async <T,>(rows: T[], fn: (batch: T[]) => Promise<unknown>, size = 400) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  };
  await chunk(orders, (data) => prisma.order.createMany({ data }));
  await chunk(items, (data) => prisma.orderItem.createMany({ data }));
  await chunk(events, (data) => prisma.orderEvent.createMany({ data }));
  await chunk(payments, (data) => prisma.payment.createMany({ data, skipDuplicates: true }));
  await chunk(refunds, (data) => prisma.refund.createMany({ data }));
  await chunk(ratings, (data) => prisma.rating.createMany({ data, skipDuplicates: true }));
  await chunk(issues, (data) => prisma.issueReport.createMany({ data, skipDuplicates: true }));

  // rider cash: old days handed over, yesterday still pending
  const yesterday = addDays(today, -1);
  const cashRows: Prisma.RiderCashDayCreateManyInput[] = [...cash.values()].map((r) => {
    const settled = r.date < yesterday;
    return { riderId: r.riderId, areaId: r.areaId, date: ymdToDate(r.date), codExpectedPaise: r.expected, depositedPaise: settled ? r.expected : 0, status: settled ? 'SETTLED' : 'OPEN', note: TAG };
  });
  await prisma.riderCashDay.createMany({ data: cashRows, skipDuplicates: true });

  // hold stock and slot capacity for orders still in progress
  for (const [date, m] of reserve) {
    const ids = [...m.keys()];
    const qtys = [...m.values()];
    await prisma.$executeRaw`
      UPDATE "DailyStock" ds SET "reservedQty" = ds."reservedQty" + v.qty
      FROM unnest(${ids}::text[], ${qtys}::int[]) AS v(id, qty)
      WHERE ds."itemId" = v.id AND ds."date" = ${ymdToDate(date)}`;
  }
  for (const [key, used] of slotUse) {
    const [slotId, date] = key.split('|');
    await prisma.$executeRaw`
      INSERT INTO "SlotBooking" ("id", "slotId", "date", "used") VALUES (${randomUUID()}, ${slotId}, ${ymdToDate(date!)}, ${used})
      ON CONFLICT ("slotId", "date") DO UPDATE SET "used" = "SlotBooking"."used" + ${used}`;
  }

  // keep the numbering counters ahead of what we used
  for (const [areaId, c] of counters) {
    await prisma.area.update({ where: { id: areaId }, data: { orderSeq: c.order, invoiceSeq: c.invoice, invoiceFy: fy, poSeq: c.po } });
  }

  const byStatus = orders.reduce<Record<string, number>>((m, o) => ((m[o.status as string] = (m[o.status as string] ?? 0) + 1), m), {});
  console.log('Demo data added:');
  console.log(`  ${orders.length} orders  ${JSON.stringify(byStatus)}`);
  console.log(`  ${items.length} order lines, ${ratings.length} ratings, ${refunds.length} refunds, ${issues.length} customer issues, ${cashRows.length} rider cash days`);
  console.log('  Demo customers sign in with phones 98000 00001 .. 98000 00014 (Jabalpur) and 98000 00100 .. 00104 (Satna), OTP 9999');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
