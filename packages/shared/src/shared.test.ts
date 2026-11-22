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
  COD_FEE_PAISE,
  COIN_VALUE_PAISE,
  coinsEarned,
  deliveryEta,
  haversineKm,
  maxCoinsUsable,
  nutritionFor,
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
    // Window closes 23:00 IST on 2026-11-02 = 17:30 UTC; orders stop 60 min before = 16:30 UTC
    expect(slotCutoff('2026-11-02', '23:00', 60).toISOString()).toBe('2026-11-02T16:30:00.000Z');
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
    // Open-box delivery: customers can cancel right up until handover.
    expect(canTransition('PACKED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransition('ARRIVED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransition('ARRIVED', 'DELIVERED', 'DELIVERY')).toBe(true);
    expect(canTransition('ARRIVED', 'DELIVERED', 'CUSTOMER')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED', 'CUSTOMER')).toBe(false);
    expect(canTransition('ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERY')).toBe(true);
    expect(canTransition('PAYMENT_PENDING', 'PLACED', 'ADMIN')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'PLACED', 'SYSTEM')).toBe(true);
    expect(canTransition('DELIVERED', 'CANCELLED', 'ADMIN')).toBe(false);
    expect(nextStatuses('OUT_FOR_DELIVERY', 'DELIVERY')).toEqual(['ARRIVED', 'DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED']);
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

describe('cash on delivery and coins', () => {
  const lines = [{ pricePaise: 20000, qty: 1 }]; // Rs 200, delivery Rs 25 (free above Rs 299)

  it('adds the COD fee only for cash orders', () => {
    expect(COD_FEE_PAISE).toBe(500);
    expect(computeTotals(lines, fees).totalPaise).toBe(22500);
    const cod = computeTotals(lines, fees, null, { cod: true });
    expect(cod.codFeePaise).toBe(500);
    expect(cod.totalPaise).toBe(23000);
  });

  it('keeps the COD fee in what is finally owed, and drops everything if all items were rejected', () => {
    expect(finalPayable(10000, 0, 2500, 500)).toBe(13000);
    expect(finalPayable(0, 0, 2500, 500)).toBe(0);
  });

  it('caps coin use at 20% of the bill and at the balance', () => {
    expect(maxCoinsUsable(20000, 1000)).toBe(40); // 20% of Rs 200
    expect(maxCoinsUsable(20000, 15)).toBe(15);
    expect(maxCoinsUsable(20000, 0)).toBe(0);
    const t = computeTotals(lines, fees, null, { coinBalance: 100, useCoins: true });
    expect(t.coinsUsed).toBe(40);
    expect(t.coinDiscountPaise).toBe(40 * COIN_VALUE_PAISE);
    expect(t.totalPaise).toBe(22500 - 4000);
    expect(computeTotals(lines, fees, null, { coinBalance: 100 }).coinsUsed).toBe(0);
  });

  it('earns 2% of what was paid, rounded down to whole coins', () => {
    expect(coinsEarned(50000)).toBe(10); // Rs 500 -> 10 coins
    expect(coinsEarned(4900)).toBe(0);
    expect(coinsEarned(0)).toBe(0);
  });
});

describe('delivery estimate', () => {
  it('measures distance and rounds the estimate to 5 minutes', () => {
    const jabalpur = { lat: 23.1815, lng: 79.9864 };
    expect(haversineKm(jabalpur, jabalpur)).toBe(0);
    const km = haversineKm(jabalpur, { lat: 23.2, lng: 80.05 });
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(8);
    const near = deliveryEta(1);
    const far = deliveryEta(8);
    expect(near.maxMinutes).toBeGreaterThan(near.minMinutes);
    expect(far.minMinutes).toBeGreaterThan(near.minMinutes);
    expect(near.minMinutes % 5).toBe(0);
  });
});

describe('nutrition', () => {
  it('matches specific names before general ones', () => {
    expect(nutritionFor('Sweet Potato (Shakarkandi)')?.tag).toBe('Rich in Vitamin A');
    expect(nutritionFor('Potato')?.tag).toBe('Good source of Potassium');
    expect(nutritionFor('Pineapple')?.calories).toBe(50);
    expect(nutritionFor('Custard Apple (Sitaphal)')?.calories).toBe(94);
    expect(nutritionFor('Apple (Shimla)')?.calories).toBe(52);
    expect(nutritionFor('Pear (Nashpati)')?.calories).toBe(57);
    expect(nutritionFor('Green Peas')?.protein).toBe(5.4);
    expect(nutritionFor('Cluster Beans (Gawar)')?.fibre).toBe(4.9);
    expect(nutritionFor('Spring Onion')?.tag).toBe('Rich in Vitamin K');
    expect(nutritionFor('Something unknown')).toBeNull();
  });

  it('covers every seeded catalog item', () => {
    const names = [
      'Tomato (Desi)', 'Potato', 'Onion', 'Carrot', 'Cucumber', 'Green Capsicum', 'Brinjal (Bharta)', 'Cauliflower', 'Cabbage', 'Bottle Gourd (Lauki)',
      'Green Peas', 'Lady Finger (Bhindi)', 'Green Chilli', 'Ginger', 'Garlic', 'Coriander (Dhania)', 'Spinach (Palak)', 'Methi', 'Mint (Pudina)', 'Lemon',
      'Banana (Robusta)', 'Apple (Shimla)', 'Papaya', 'Pomegranate', 'Orange (Nagpur)', 'Watermelon', 'Broccoli', 'Mushroom (Button)', 'Kiwi', 'Coconut (Tender)',
      'Pumpkin (Kaddu)', 'Bitter Gourd (Karela)', 'Ridge Gourd (Turai)', 'Radish (Mooli)', 'Beetroot', 'Sweet Potato (Shakarkandi)', 'French Beans', 'Cluster Beans (Gawar)',
      'Drumstick', 'Raw Banana', 'Tinda', 'Spring Onion', 'Red Onion (Small, Sambhar)', 'Baby Corn', 'Curry Leaves', 'Dill (Sua)', 'Mustard Greens (Sarson)',
      'Raw Turmeric (Haldi)', 'Mango (Dussehri)', 'Grapes (Green, Seedless)', 'Guava (Amrood)', 'Sweet Lime (Mosambi)', 'Pear (Nashpati)', 'Pineapple',
      'Muskmelon (Kharbuja)', 'Chikoo (Sapota)', 'Custard Apple (Sitaphal)', 'Banana (Elaichi)', 'Zucchini', 'Red Bell Pepper', 'Yellow Bell Pepper', 'Cherry Tomato',
      'Iceberg Lettuce', 'Avocado', 'Dragon Fruit', 'Coriander + Chilli Combo', 'Salad Pack (Cucumber, Carrot, Beet)',
    ];
    expect(names.filter((n) => !nutritionFor(n))).toEqual([]);
  });
});

