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

export interface Totals {
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  meetsMinOrder: boolean;
  amountToFreeDeliveryPaise: number;
}

export function computeTotals(
  lines: { pricePaise: number; qty: number }[],
  fees: AreaFees,
  coupon?: CouponRule | null,
): Totals {
  const subtotalPaise = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const discountPaise = couponDiscount(subtotalPaise, coupon);
  const fee = deliveryFee(subtotalPaise, fees);
  return {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise: fee,
    totalPaise: Math.max(0, subtotalPaise - discountPaise + fee),
    meetsMinOrder: subtotalPaise >= fees.minOrderPaise,
    amountToFreeDeliveryPaise: Math.max(0, fees.freeDeliveryAbovePaise - subtotalPaise),
  };
}

/**
 * Amount the customer finally owes after shortages and doorstep rejections.
 * The original discount and delivery fee stand, except the discount can never exceed
 * what is left and nothing is charged if every item was rejected.
 */
export function finalPayable(effectiveSubtotalPaise: number, discountPaise: number, deliveryFeePaise: number): number {
  if (effectiveSubtotalPaise <= 0) return 0;
  return Math.max(0, effectiveSubtotalPaise - Math.min(discountPaise, effectiveSubtotalPaise) + deliveryFeePaise);
}

export function effectiveLineQty(line: { qty: number; packedQty?: number | null; rejectedQty?: number | null }): number {
  return Math.max(0, (line.packedQty ?? line.qty) - (line.rejectedQty ?? 0));
}
