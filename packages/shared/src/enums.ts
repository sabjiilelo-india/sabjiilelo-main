const values = <T extends string>(...v: T[]) =>
  Object.freeze(Object.fromEntries(v.map((k) => [k, k])) as { [K in T]: K });

export const Role = values('SUPERADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR', 'CUSTOMER');
export type Role = keyof typeof Role;

export const UserStatus = values('ACTIVE', 'BLOCKED');
export type UserStatus = keyof typeof UserStatus;

export const UnitType = values('KG', 'GRAM', 'LITRE', 'PIECE', 'BUNCH', 'DOZEN', 'PACK');
export type UnitType = keyof typeof UnitType;

export const OrderStatus = values(
  'PAYMENT_PENDING',
  'PLACED',
  'CONFIRMED',
  'PACKING',
  'PACKED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PARTIALLY_DELIVERED',
  'CANCELLED',
);
export type OrderStatus = keyof typeof OrderStatus;

export const OrderChannel = values('APP', 'WEB', 'POS');
export type OrderChannel = keyof typeof OrderChannel;

export const PaymentMode = values('RAZORPAY', 'COD', 'CASH', 'UPI');
export type PaymentMode = keyof typeof PaymentMode;

export const PaymentStatus = values('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');
export type PaymentStatus = keyof typeof PaymentStatus;

export const RefundSource = values('DOORSTEP', 'ISSUE', 'CANCEL', 'SHORTAGE');
export type RefundSource = keyof typeof RefundSource;

export const RefundStatus = values('REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED');
export type RefundStatus = keyof typeof RefundStatus;

export const IssueType = values('MISSING', 'DAMAGED', 'QUALITY', 'WRONG_ITEM', 'OTHER');
export type IssueType = keyof typeof IssueType;

export const IssueStatus = values('OPEN', 'APPROVED', 'REJECTED');
export type IssueStatus = keyof typeof IssueStatus;

export const CouponType = values('FLAT', 'PERCENT');
export type CouponType = keyof typeof CouponType;

export const PoStatus = values('SENT', 'ACCEPTED', 'ADJUSTED', 'REJECTED', 'RECEIVED', 'CLOSED');
export type PoStatus = keyof typeof PoStatus;

export const LedgerType = values('PAYABLE', 'PAYMENT');
export type LedgerType = keyof typeof LedgerType;

export const CashStatus = values('OPEN', 'SETTLED', 'SHORT');
export type CashStatus = keyof typeof CashStatus;

export const StockMovementType = values('PURCHASE', 'SALE', 'WASTAGE', 'ADJUST', 'RELEASE');
export type StockMovementType = keyof typeof StockMovementType;

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  HR: 'HR',
  DELIVERY: 'Delivery Partner',
  VENDOR: 'Vendor',
  CUSTOMER: 'Customer',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'Awaiting payment',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PACKING: 'Packing',
  PACKED: 'Packed',
  ASSIGNED: 'Rider assigned',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PARTIALLY_DELIVERED: 'Delivered (partial)',
  CANCELLED: 'Cancelled',
};

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  MISSING: 'Item missing',
  DAMAGED: 'Damaged',
  QUALITY: 'Poor quality',
  WRONG_ITEM: 'Wrong item',
  OTHER: 'Other',
};

export const DOORSTEP_REJECT_REASONS = ['Not fresh', 'Damaged', 'Wrong item', 'Short weight', 'Changed mind'] as const;
