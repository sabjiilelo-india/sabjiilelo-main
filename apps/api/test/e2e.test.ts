/**
 * Full business flow against the configured database, inside a throwaway area that is deleted afterwards:
 * super admin -> admin -> staff -> catalog -> customer orders (COD + prepaid) -> packing with shortage ->
 * dispatch -> doorstep return -> issue refund -> COD settlement -> vendor PO -> payout -> reports.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

let app: Express;
const rnd = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

const code = `Z${letters(3)}`;
const pincode = `99${rnd(4)}`;
const phones = {
  admin: `6${rnd(9)}`,
  manager: `6${rnd(9)}`,
  accountant: `6${rnd(9)}`,
  rider: `6${rnd(9)}`,
  vendor: `6${rnd(9)}`,
  customer: `6${rnd(9)}`,
};
const tokens: Record<string, string> = {};
const ctx: Record<string, string> = {};

async function otpLogin(phone: string, client: 'web' | 'app' = 'web') {
  await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
  const res = await request(app).post('/api/auth/otp/verify').send({ phone, code: '9999', client });
  return res;
}

const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  app = createApp();
});

afterAll(async () => {
  const area = await prisma.area.findUnique({ where: { code } });
  if (area) {
    await prisma.order.deleteMany({ where: { areaId: area.id } });
    await prisma.vendorLedger.deleteMany({ where: { areaId: area.id } });
    await prisma.purchaseOrder.deleteMany({ where: { areaId: area.id } });
    await prisma.riderCashDay.deleteMany({ where: { areaId: area.id } });
    await prisma.vendor.deleteMany({ where: { areaId: area.id } });
    await prisma.auditLog.deleteMany({ where: { areaId: area.id } });
    await prisma.address.deleteMany({ where: { areaId: area.id } });
    await prisma.user.deleteMany({ where: { areaId: area.id } });
    await prisma.area.delete({ where: { id: area.id } });
  }
  await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
  await prisma.otpCode.deleteMany({ where: { phone: { in: Object.values(phones) } } });
  await prisma.$disconnect();
});

describe('Sabjii Le Lo end to end', () => {
  it('super admin creates an area and its admin', async () => {
    const login = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: process.env.SUPERADMIN_USERNAME ?? 'superadmin', password: process.env.SUPERADMIN_PASSWORD ?? 'Sabjii@123' })
      .expect(200);
    tokens.super = login.body.accessToken;

    const area = await request(app)
      .post('/api/areas')
      .set(as('super'))
      .send({ code, name: `Test ${code}`, city: 'Testpur', pincodes: [pincode], autoRefundLimitPaise: 5000, minOrderPaise: 1000 })
      .expect(201);
    ctx.areaId = area.body.id;

    await request(app).post('/api/admins').set(as('super')).send({ phone: phones.admin, name: 'Test Admin', areaId: ctx.areaId }).expect(201);
    // One admin per area
    await request(app).post('/api/admins').set(as('super')).send({ phone: `6${rnd(9)}`, name: 'Second', areaId: ctx.areaId }).expect(409);
  });

  it('admin signs in with OTP and onboards staff', async () => {
    const res = await otpLogin(phones.admin);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    tokens.admin = res.body.accessToken;

    // Admins cannot use the mobile app
    expect((await otpLogin(phones.admin, 'app')).status).toBe(403);

    for (const [key, role] of [
      ['manager', 'MANAGER'],
      ['accountant', 'ACCOUNTANT'],
      ['rider', 'DELIVERY'],
    ] as const) {
      await request(app).post('/api/staff').set(as('admin')).send({ phone: phones[key], name: `Test ${role}`, role }).expect(201);
    }
    await request(app)
      .post('/api/staff')
      .set(as('admin'))
      .send({ phone: phones.vendor, name: 'Test Vendor', role: 'VENDOR', vendor: { businessName: 'Test Traders' } })
      .expect(201);
    // Admin cannot create another admin
    await request(app).post('/api/staff').set(as('admin')).send({ phone: `6${rnd(9)}`, name: 'X', role: 'ADMIN' }).expect(400);

    for (const key of ['manager', 'accountant', 'rider', 'vendor'] as const) {
      const r = await otpLogin(phones[key], key === 'rider' || key === 'vendor' ? 'app' : 'web');
      expect(r.status).toBe(200);
      tokens[key] = r.body.accessToken;
    }
  });

  it('admin builds the catalog and manager stocks it', async () => {
    const cat = await request(app).post('/api/manage/categories').set(as('admin')).send({ name: 'Veg' }).expect(201);
    const tomato = await request(app)
      .post('/api/manage/items')
      .set(as('admin'))
      .send({
        categoryId: cat.body.id,
        name: 'Test Tomato',
        unitType: 'KG',
        variants: [
          { label: '500 g', baseQty: 500, pricePaise: 2000, mrpPaise: 2500 },
          { label: '1 kg', baseQty: 1000, pricePaise: 3800, mrpPaise: 4500 },
        ],
      })
      .expect(201);
    const coconut = await request(app)
      .post('/api/manage/items')
      .set(as('admin'))
      .send({ categoryId: cat.body.id, name: 'Test Coconut', unitType: 'PIECE', variants: [{ label: '1 pc', baseQty: 1, pricePaise: 4500, mrpPaise: 5000 }] })
      .expect(201);
    ctx.tomato = tomato.body.id;
    ctx.tomato500 = tomato.body.variants[0].id;
    ctx.tomato1kg = tomato.body.variants[1].id;
    ctx.coconut = coconut.body.id;
    ctx.coconutV = coconut.body.variants[0].id;

    // Managers cannot edit the catalog, only prices and stock
    await request(app).post('/api/manage/categories').set(as('manager')).send({ name: 'Nope' }).expect(403);

    const slots = await request(app).get(`/api/catalog/slots?areaId=${ctx.areaId}`).expect(200);
    const slot = slots.body.find((s: { available: boolean }) => s.available);
    expect(slot).toBeTruthy();
    ctx.slotId = slot.slotId;
    ctx.slotDate = slot.date;

    await request(app)
      .put('/api/manage/stock')
      .set(as('manager'))
      .send({ date: ctx.slotDate, rows: [{ itemId: ctx.tomato, availableQty: 5000 }, { itemId: ctx.coconut, availableQty: 10 }] })
      .expect(200);

    await request(app)
      .post('/api/manage/coupons')
      .set(as('admin'))
      .send({ code: 'TEST10', type: 'FLAT', value: 1000, minOrderPaise: 0, validFrom: '2020-01-01', validTo: '2099-12-31', perUserLimit: 5 })
      .expect(201);
  });

  it('keeps areas isolated', async () => {
    const jbpItem = await prisma.item.findFirst({ where: { area: { code: 'JBP' } } });
    if (jbpItem) await request(app).get(`/api/manage/items/${jbpItem.id}`).set(as('admin')).expect(403);
    const jbpOrder = await prisma.order.findFirst({ where: { area: { code: 'JBP' } } });
    if (jbpOrder) await request(app).get(`/api/ops/orders/${jbpOrder.id}`).set(as('manager')).expect(403);
    await request(app).get('/api/ops/orders').set(as('rider')).expect(403);
    await request(app).get('/api/accounts/cod').set(as('manager')).expect(403);
  });

  it('customer signs up, browses and places a COD and a prepaid order', async () => {
    const login = await otpLogin(phones.customer, 'app');
    expect(login.body.user.role).toBe('CUSTOMER');
    tokens.customer = login.body.accessToken;

    const svc = await request(app).get(`/api/catalog/serviceability?pincode=${pincode}`).expect(200);
    expect(svc.body.serviceable).toBe(true);
    const items = await request(app).get(`/api/catalog/items?areaId=${ctx.areaId}&date=${ctx.slotDate}`).expect(200);
    expect(items.body.items).toHaveLength(2);

    const addr = await request(app)
      .post('/api/me/addresses')
      .set(as('customer'))
      .send({ name: 'Test Customer', phone: phones.customer, line1: '1 Test Street', city: 'Testpur', pincode })
      .expect(201);
    ctx.addressId = addr.body.id;
    expect(addr.body.serviceable).toBe(true);

    // COD order: 2 x 1 kg tomato + 1 coconut, with coupon
    await request(app).put('/api/me/cart').set(as('customer')).send({ variantId: ctx.tomato1kg, qty: 2 }).expect(200);
    await request(app).put('/api/me/cart').set(as('customer')).send({ variantId: ctx.coconutV, qty: 1 }).expect(200);
    const quote = await request(app).post('/api/me/checkout/quote').set(as('customer')).send({ addressId: ctx.addressId, couponCode: 'TEST10' }).expect(200);
    expect(quote.body.subtotalPaise).toBe(3800 * 2 + 4500);
    expect(quote.body.discountPaise).toBe(1000);

    const cod = await request(app)
      .post('/api/me/orders')
      .set(as('customer'))
      .send({ addressId: ctx.addressId, slotId: ctx.slotId, slotDate: ctx.slotDate, couponCode: 'TEST10', paymentMode: 'COD', channel: 'APP' })
      .expect(201);
    expect(cod.body.order.status).toBe('PLACED');
    ctx.codOrder = cod.body.order.id;

    // Prepaid order: 3 x 500 g tomato
    await request(app).put('/api/me/cart').set(as('customer')).send({ variantId: ctx.tomato500, qty: 3 }).expect(200);
    const pre = await request(app)
      .post('/api/me/orders')
      .set(as('customer'))
      .send({ addressId: ctx.addressId, slotId: ctx.slotId, slotDate: ctx.slotDate, paymentMode: 'RAZORPAY', channel: 'APP' })
      .expect(201);
    expect(pre.body.order.status).toBe('PAYMENT_PENDING');
    expect(pre.body.razorpay.mock).toBe(true);
    ctx.preOrder = pre.body.order.id;

    const mock = await request(app).post('/api/payments/mock-checkout').set(as('customer')).send({ razorpayOrderId: pre.body.razorpay.razorpayOrderId }).expect(200);
    const paid = await request(app).post('/api/payments/verify').set(as('customer')).send({ orderId: ctx.preOrder, ...mock.body }).expect(200);
    expect(paid.body.status).toBe('PLACED');
    expect(paid.body.paymentStatus).toBe('PAID');

    // Stock reserved: 2 kg + 1.5 kg tomatoes
    const stock = await request(app).get(`/api/manage/stock?date=${ctx.slotDate}`).set(as('manager')).expect(200);
    expect(stock.body.rows.find((r: { itemId: string }) => r.itemId === ctx.tomato).reservedQty).toBe(3500);

    // Overselling is refused
    await request(app).put('/api/me/cart').set(as('customer')).send({ variantId: ctx.tomato1kg, qty: 2 }).expect(200);
    await request(app)
      .post('/api/me/orders')
      .set(as('customer'))
      .send({ addressId: ctx.addressId, slotId: ctx.slotId, slotDate: ctx.slotDate, paymentMode: 'COD' })
      .expect(400);
    await request(app).delete('/api/me/cart').set(as('customer')).expect(200);
  });

  it('manager packs with a shortage and dispatches', async () => {
    await request(app).post('/api/ops/orders/bulk-confirm').set(as('manager')).send({ orderIds: [ctx.codOrder, ctx.preOrder] }).expect(200);

    const pick = await request(app).get(`/api/ops/picklist?date=${ctx.slotDate}`).set(as('manager')).expect(200);
    expect(pick.body.rows.find((r: { itemId: string }) => r.itemId === ctx.tomato).totalBaseQty).toBe(3500);

    const codDetail = await request(app).get(`/api/ops/orders/${ctx.codOrder}`).set(as('manager')).expect(200);
    const tomatoLine = codDetail.body.items.find((i: { itemId: string }) => i.itemId === ctx.tomato);
    // Only 1 of the 2 kg tomato packs available
    const packed = await request(app)
      .post(`/api/ops/orders/${ctx.codOrder}/pack`)
      .set(as('manager'))
      .send({ items: [{ orderItemId: tomatoLine.id, packedQty: 1 }] })
      .expect(200);
    expect(packed.body.status).toBe('PACKED');
    expect(packed.body.finalPayablePaise).toBe(3800 + 4500 - 1000 + packed.body.deliveryFeePaise);
    expect(packed.body.invoiceNo).toMatch(new RegExp(`^${code}/`));

    await request(app).post(`/api/ops/orders/${ctx.preOrder}/pack`).set(as('manager')).send({ items: [] }).expect(200);

    const pdf = await request(app).get(`/api/invoices/${ctx.codOrder}/bill.pdf`).set(as('manager')).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const riders = await request(app).get('/api/ops/riders').set(as('manager')).expect(200);
    ctx.riderId = riders.body[0].id;
    await request(app).post('/api/ops/dispatch').set(as('manager')).send({ orderIds: [ctx.codOrder, ctx.preOrder], riderId: ctx.riderId }).expect(200);
  });

  it('rider delivers; the customer returns a tomato pack at the door', async () => {
    await request(app).post('/api/rider/online').set(as('rider')).send({ isOnline: true }).expect(200);
    const mine = await request(app).get('/api/rider/orders').set(as('rider')).expect(200);
    expect(mine.body).toHaveLength(2);

    // Prepaid: reject 1 of 3 packs -> instant refund of ₹20 (under the ₹50 auto limit)
    await request(app).post(`/api/rider/orders/${ctx.preOrder}/start`).set(as('rider')).expect(200);
    const pre = await request(app).get(`/api/rider/orders/${ctx.preOrder}`).set(as('rider')).expect(200);
    const delivered = await request(app)
      .post(`/api/rider/orders/${ctx.preOrder}/deliver`)
      .set(as('rider'))
      .send({ rejections: [{ orderItemId: pre.body.items[0].id, qty: 1, reason: 'Not fresh' }] })
      .expect(200);
    expect(delivered.body.status).toBe('PARTIALLY_DELIVERED');
    const doorRefund = delivered.body.refunds.find((r: { source: string }) => r.source === 'DOORSTEP');
    expect(doorRefund.amountPaise).toBe(2000);
    expect(doorRefund.status).toBe('PROCESSED');

    // COD: delivered in full, cash collected
    await request(app).post(`/api/rider/orders/${ctx.codOrder}/start`).set(as('rider')).expect(200);
    const cod = await request(app).post(`/api/rider/orders/${ctx.codOrder}/deliver`).set(as('rider')).send({}).expect(200);
    expect(cod.body.status).toBe('DELIVERED');
    expect(cod.body.codCollectedPaise).toBe(cod.body.finalPayablePaise);
    ctx.codCollected = String(cod.body.codCollectedPaise);
  });

  it('customer rates and reports an issue; accountant refunds it', async () => {
    await request(app).post(`/api/me/orders/${ctx.codOrder}/rating`).set(as('customer')).send({ stars: 5, comment: 'Super fresh' }).expect(200);
    const order = await request(app).get(`/api/me/orders/${ctx.codOrder}`).set(as('customer')).expect(200);
    const coconutLine = order.body.items.find((i: { itemId: string }) => i.itemId === ctx.coconut);
    await request(app)
      .post(`/api/me/orders/${ctx.codOrder}/issues`)
      .set(as('customer'))
      .send({ orderItemId: coconutLine.id, type: 'DAMAGED', description: 'Cracked' })
      .expect(201);

    const issues = await request(app).get('/api/accounts/issues').set(as('accountant')).expect(200);
    expect(issues.body).toHaveLength(1);
    expect(issues.body[0].suggestedRefundPaise).toBe(4500);
    await request(app).post(`/api/accounts/issues/${issues.body[0].id}/resolve`).set(as('accountant')).send({ action: 'APPROVE' }).expect(200);

    const after = await request(app).get(`/api/me/orders/${ctx.codOrder}`).set(as('customer')).expect(200);
    expect(after.body.refunds.find((r: { source: string }) => r.source === 'ISSUE').status).toBe('PROCESSED');
  });

  it('accountant reconciles COD cash', async () => {
    const cod = await request(app).get('/api/accounts/cod').set(as('accountant')).expect(200);
    const row = cod.body.rows.find((r: { riderId: string }) => r.riderId === ctx.riderId);
    expect(row.codExpectedPaise).toBe(Number(ctx.codCollected));
    const settled = await request(app)
      .post(`/api/accounts/cod/${ctx.riderId}/settle`)
      .set(as('accountant'))
      .send({ date: cod.body.date, depositedPaise: row.codExpectedPaise })
      .expect(200);
    expect(settled.body.status).toBe('SETTLED');
  });

  it('vendor quotes rates, accepts a PO, goods are received and paid', async () => {
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    await request(app).put('/api/vendor/rates').set(as('vendor')).send({ date: today, rates: [{ itemId: ctx.tomato, ratePaise: 2200 }] }).expect(200);

    const demand = await request(app).get(`/api/supply/demand?date=${today}`).set(as('manager')).expect(200);
    const row = demand.body.rows.find((r: { itemId: string }) => r.itemId === ctx.tomato);
    expect(row.bestRate.ratePaise).toBe(2200);

    const vendors = await request(app).get('/api/supply/vendors').set(as('manager')).expect(200);
    const po = await request(app)
      .post('/api/supply/pos')
      .set(as('manager'))
      .send({ vendorId: vendors.body[0].id, forDate: today, items: [{ itemId: ctx.tomato, orderedQty: 10000, ratePaise: 2200 }] })
      .expect(201);

    const inbox = await request(app).get('/api/vendor/pos').set(as('vendor')).expect(200);
    expect(inbox.body[0].id).toBe(po.body.id);
    await request(app)
      .post(`/api/vendor/pos/${po.body.id}/respond`)
      .set(as('vendor'))
      .send({ action: 'ADJUST', items: [{ poItemId: po.body.items[0].id, acceptedQty: 8000 }] })
      .expect(200);

    const received = await request(app)
      .post(`/api/supply/pos/${po.body.id}/receive`)
      .set(as('manager'))
      .send({ items: [{ poItemId: po.body.items[0].id, receivedQty: 8000 }], addToStockDate: today })
      .expect(200);
    expect(received.body.status).toBe('RECEIVED');
    expect(received.body.totalPaise).toBe(17600); // 8 kg x ₹22

    const balances = await request(app).get('/api/accounts/vendors').set(as('accountant')).expect(200);
    expect(balances.body[0].balancePaise).toBe(17600);
    await request(app)
      .post(`/api/accounts/vendors/${balances.body[0].vendorId}/payments`)
      .set(as('accountant'))
      .send({ amountPaise: 17600, reference: 'UPI123' })
      .expect(201);
    const ledger = await request(app).get('/api/vendor/ledger').set(as('vendor')).expect(200);
    expect(ledger.body.balancePaise).toBe(0);
  });

  it('customer cancels before cutoff and stock is released; counter sale works', async () => {
    const before = await request(app).get(`/api/manage/stock?date=${ctx.slotDate}`).set(as('manager')).expect(200);
    const reservedBefore = before.body.rows.find((r: { itemId: string }) => r.itemId === ctx.coconut).reservedQty;

    await request(app).put('/api/me/cart').set(as('customer')).send({ variantId: ctx.coconutV, qty: 2 }).expect(200);
    const o = await request(app)
      .post('/api/me/orders')
      .set(as('customer'))
      .send({ addressId: ctx.addressId, slotId: ctx.slotId, slotDate: ctx.slotDate, paymentMode: 'COD' })
      .expect(201);
    expect(o.body.order.canCancel).toBe(true);
    const c = await request(app).post(`/api/me/orders/${o.body.order.id}/cancel`).set(as('customer')).send({ reason: 'Changed plans' }).expect(200);
    expect(c.body.status).toBe('CANCELLED');

    const after = await request(app).get(`/api/manage/stock?date=${ctx.slotDate}`).set(as('manager')).expect(200);
    expect(after.body.rows.find((r: { itemId: string }) => r.itemId === ctx.coconut).reservedQty).toBe(reservedBefore);

    const pos = await request(app)
      .post('/api/ops/pos/orders')
      .set(as('manager'))
      .send({ items: [{ variantId: ctx.tomato500, qty: 2 }], paymentMode: 'CASH' })
      .expect(201);
    expect(pos.body.status).toBe('DELIVERED');
    expect(pos.body.totalPaise).toBe(4000);
  });

  it('reports and dashboard add up', async () => {
    const sales = await request(app).get(`/api/reports/sales?from=2020-01-01&to=2099-12-31`).set(as('accountant')).expect(200);
    expect(sales.body.totals.orders).toBeGreaterThanOrEqual(3);
    const dash = await request(app).get(`/api/reports/dashboard?date=${ctx.slotDate}`).set(as('admin')).expect(200);
    expect(dash.body.ordersCount).toBeGreaterThanOrEqual(2);
    const csv = await request(app).get(`/api/reports/orders.csv?from=2020-01-01&to=2099-12-31`).set(as('accountant')).expect(200);
    expect(csv.text).toContain('Order No');
  });
});
