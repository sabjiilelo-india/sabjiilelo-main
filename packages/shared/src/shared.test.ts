import { describe, expect, it } from 'vitest';
import {
  canTransition,
  computeTotals,
  costPaise,
  couponDiscount,
  effectiveLineQty,
  finalPayable,
  financialYear,
  formatINR,
  formatQty,
  nextStatuses,
  phoneSchema,
  slotCutoff,
  toBaseQty,
  addDays,
  appPathFor,
  notificationTarget,
  webPathFor,
  dayOfWeek,
} from './index';

const fees = { minOrderPaise: 9900, deliveryFeePaise: 2500, freeDeliveryAbovePaise: 29900 };

describe('money', () => {
  it('computes totals with delivery fee below threshold', () => {
    const t = computeTotals([{ pricePaise: 4000, qty: 2 }, { pricePaise: 3000, qty: 1 }], fees);
    expect(t.subtotalPaise).toBe(11000);
    expect(t.deliveryFeePaise).toBe(2500);
    expect(t.totalPaise).toBe(13500);
    expect(t.meetsMinOrder).toBe(true);
    expect(t.amountToFreeDeliveryPaise).toBe(18900);
  });

  it('gives free delivery above threshold', () => {
    const t = computeTotals([{ pricePaise: 30000, qty: 1 }], fees);
    expect(t.deliveryFeePaise).toBe(0);
  });

  it('flags orders below the minimum', () => {
    expect(computeTotals([{ pricePaise: 5000, qty: 1 }], fees).meetsMinOrder).toBe(false);
  });

  it('applies flat and percent coupons with caps and minimums', () => {
    expect(couponDiscount(20000, { type: 'FLAT', value: 5000, minOrderPaise: 10000 })).toBe(5000);
    expect(couponDiscount(5000, { type: 'FLAT', value: 5000, minOrderPaise: 10000 })).toBe(0);
    expect(couponDiscount(20000, { type: 'PERCENT', value: 20, minOrderPaise: 0, maxDiscountPaise: 3000 })).toBe(3000);
    expect(couponDiscount(1000, { type: 'FLAT', value: 5000, minOrderPaise: 0 })).toBe(1000);
  });

  it('recalculates the final payable after rejections', () => {
    expect(finalPayable(10000, 2000, 2500)).toBe(10500);
    expect(finalPayable(1000, 2000, 2500)).toBe(2500);
    expect(finalPayable(0, 2000, 2500)).toBe(0);
    expect(effectiveLineQty({ qty: 3, packedQty: 2, rejectedQty: 1 })).toBe(1);
    expect(effectiveLineQty({ qty: 3, packedQty: null, rejectedQty: 0 })).toBe(3);
  });

  it('formats rupees', () => {
    expect(formatINR(123400)).toBe('₹1,234');
    expect(formatINR(12350)).toBe('₹123.50');
  });
});

describe('units', () => {
  it('formats base quantities', () => {
    expect(formatQty('KG', 1500)).toBe('1.5 kg');
    expect(formatQty('KG', 250)).toBe('250 g');
    expect(formatQty('LITRE', 500)).toBe('500 ml');
    expect(formatQty('BUNCH', 2)).toBe('2 bunches');
    expect(formatQty('DOZEN', 1)).toBe('1 dozen');
  });

  it('converts and costs quantities', () => {
    expect(toBaseQty('KG', 2.5)).toBe(2500);
    expect(toBaseQty('PIECE', 3)).toBe(3);
    expect(costPaise('KG', 2500, 4000)).toBe(10000);
    expect(costPaise('PIECE', 3, 1500)).toBe(4500);
  });
});

describe('dates', () => {
  it('computes slot cutoff in IST', () => {
    // 7:00 IST on 2026-11-02 = 01:30 UTC; 10h earlier = 15:30 UTC on 2026-11-01
    expect(slotCutoff('2026-11-02', '07:00', 600).toISOString()).toBe('2026-11-01T15:30:00.000Z');
  });

  it('handles day math and financial year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayOfWeek('2026-11-01')).toBe(0);
    expect(financialYear('2026-11-01')).toBe('2026-27');
    expect(financialYear('2027-03-31')).toBe('2026-27');
    expect(financialYear('2027-04-01')).toBe('2027-28');
  });
});

describe('order machine', () => {
  it('allows only the right roles to move orders', () => {
    expect(canTransition('PLACED', 'CONFIRMED', 'MANAGER')).toBe(true);
    expect(canTransition('PLACED', 'CONFIRMED', 'CUSTOMER')).toBe(false);
    expect(canTransition('PLACED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransition('PACKED', 'CANCELLED', 'CUSTOMER')).toBe(false);
    expect(canTransition('ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERY')).toBe(true);
    expect(canTransition('PAYMENT_PENDING', 'PLACED', 'ADMIN')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'PLACED', 'SYSTEM')).toBe(true);
    expect(canTransition('DELIVERED', 'CANCELLED', 'ADMIN')).toBe(false);
    expect(nextStatuses('OUT_FOR_DELIVERY', 'DELIVERY')).toEqual(['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED']);
  });
});

describe('schemas', () => {
  it('normalises Indian phone numbers', () => {
    expect(phoneSchema.parse('+91 98765 43210')).toBe('9876543210');
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    expect(phoneSchema.safeParse('5876543210').success).toBe(false);
  });
});

describe('notification routing', () => {
  it('points each notification at the right screen for the viewer', () => {
    expect(notificationTarget({ orderId: 'o1' })).toEqual({ kind: 'order', id: 'o1' });
    expect(notificationTarget({ poId: 'p1' })).toEqual({ kind: 'po', id: 'p1' });
    expect(notificationTarget({ screen: 'deliveries' })).toEqual({ kind: 'deliveries' });
    expect(notificationTarget(null)).toBeNull();
    expect(webPathFor('CUSTOMER', { kind: 'order', id: 'o1' })).toBe('/orders/o1');
    expect(webPathFor('MANAGER', { kind: 'order', id: 'o1' })).toBe('/dashboard/orders/o1');
    expect(webPathFor('VENDOR', { kind: 'po', id: 'p1' })).toBe('/dashboard/vendor/orders/p1');
    expect(appPathFor('DELIVERY', { kind: 'order', id: 'o1' })).toBe('/delivery/o1');
    expect(appPathFor('CUSTOMER', { kind: 'order', id: 'o1' })).toBe('/order/o1');
    expect(appPathFor('VENDOR', { kind: 'po', id: 'p1' })).toBe('/vendor-po/p1');
  });
});
