import type { CouponType } from './enums';

/** All money is integer paise. */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = (paise || 0) / 100;
  const showDecimals = opts.decimals ?? !Number.isInteger(rupees);
  return (
    '₹' +
    rupees.toLocaleString('en-IN', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    })
  );
}

export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export interface AreaFees {
  minOrderPaise: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number;
}

export interface CouponRule {
  type: CouponType;
  value: number; // paise for FLAT, percent for PERCENT
  maxDiscountPaise?: number | null;
  minOrderPaise: number;
}

export function couponDiscount(subtotalPaise: number, coupon: CouponRule | null | undefined): number {
  if (!coupon || subtotalPaise < coupon.minOrderPaise) return 0;
  let d = coupon.type === 'FLAT' ? coupon.value : Math.floor((subtotalPaise * coupon.value) / 100);
  if (coupon.maxDiscountPaise != null) d = Math.min(d, coupon.maxDiscountPaise);
  return Math.max(0, Math.min(d, subtotalPaise));
}

export function deliveryFee(subtotalPaise: number, fees: AreaFees): number {
  if (subtotalPaise <= 0) return 0;
  return subtotalPaise >= fees.freeDeliveryAbovePaise ? 0 : fees.deliveryFeePaise;
}

/** Extra charged on cash-on-delivery orders (covers cash handling). */
export const COD_FEE_PAISE = 500;

/** Sabjii Coins. 1 coin = Rs 1 at checkout. */
export const COIN_VALUE_PAISE = 100;
/** Coins earned on a delivered order, as a percent of what the customer finally paid. */
export const COIN_EARN_PERCENT = 2;
/** Most of an order's value (after coupon) that coins can pay for, in percent. */
export const COIN_MAX_REDEEM_PERCENT = 20;

/** Coins earned for an amount paid, in whole coins. */
export function coinsEarned(paidPaise: number): number {
  return Math.max(0, Math.floor((paidPaise * COIN_EARN_PERCENT) / 100 / COIN_VALUE_PAISE));
}

/** Most coins a customer can spend on an order worth `payablePaise` (after coupon), given their balance. */
export function maxCoinsUsable(payablePaise: number, balance: number): number {
  const cap = Math.floor((Math.max(0, payablePaise) * COIN_MAX_REDEEM_PERCENT) / 100 / COIN_VALUE_PAISE);
  return Math.max(0, Math.min(balance, cap));
}

export interface Totals {
  subtotalPaise: number;
  /** Coupon discount only. */
  discountPaise: number;
  deliveryFeePaise: number;
  codFeePaise: number;
  coinsUsed: number;
  coinDiscountPaise: number;
  /** Most coins that could be applied to this order (0 when the customer has none). */
  maxCoinsUsable: number;
  totalPaise: number;
  meetsMinOrder: boolean;
  amountToFreeDeliveryPaise: number;
}

export interface TotalsOptions {
  /** Cash on delivery adds COD_FEE_PAISE. */
  cod?: boolean;
  /** Customer's coin balance. */
  coinBalance?: number;
  /** Spend as many coins as allowed. */
  useCoins?: boolean;
}

export function computeTotals(
  lines: { pricePaise: number; qty: number }[],
  fees: AreaFees,
  coupon?: CouponRule | null,
  opts: TotalsOptions = {},
): Totals {
  const subtotalPaise = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const discountPaise = couponDiscount(subtotalPaise, coupon);
  const fee = deliveryFee(subtotalPaise, fees);
  const codFeePaise = opts.cod && subtotalPaise > 0 ? COD_FEE_PAISE : 0;
  const maxCoins = maxCoinsUsable(subtotalPaise - discountPaise, opts.coinBalance ?? 0);
  const coinsUsed = opts.useCoins ? maxCoins : 0;
  const coinDiscountPaise = coinsUsed * COIN_VALUE_PAISE;
  return {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise: fee,
    codFeePaise,
    coinsUsed,
    coinDiscountPaise,
    maxCoinsUsable: maxCoins,
    totalPaise: Math.max(0, subtotalPaise - discountPaise - coinDiscountPaise + fee + codFeePaise),
    meetsMinOrder: subtotalPaise >= fees.minOrderPaise,
    amountToFreeDeliveryPaise: Math.max(0, fees.freeDeliveryAbovePaise - subtotalPaise),
  };
}

/**
 * Amount the customer finally owes after shortages and doorstep rejections.
 * The original discount (coupon and coins) and the delivery and COD fees stand, except the discount can
 * never exceed what is left and nothing is charged if every item was rejected.
 */
export function finalPayable(
  effectiveSubtotalPaise: number,
  discountPaise: number,
  deliveryFeePaise: number,
  codFeePaise = 0,
): number {
  if (effectiveSubtotalPaise <= 0) return 0;
  return Math.max(0, effectiveSubtotalPaise - Math.min(discountPaise, effectiveSubtotalPaise) + deliveryFeePaise + codFeePaise);
}

export function effectiveLineQty(line: { qty: number; packedQty?: number | null; rejectedQty?: number | null }): number {
  return Math.max(0, (line.packedQty ?? line.qty) - (line.rejectedQty ?? 0));
}
