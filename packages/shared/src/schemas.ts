import { z } from 'zod';
import {
  CouponType,
  IssueType,
  OrderStatus,
  PaymentMode,
  Role,
  UnitType,
  UserStatus,
} from './enums';

const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));
export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM');
export const pincodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode');
const paise = z.number().int().min(0);
const id = z.string().min(1);

export const roleSchema = enumOf(Role);
export const unitTypeSchema = enumOf(UnitType);
export const orderStatusSchema = enumOf(OrderStatus);

// ---------- auth ----------
export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit OTP'),
  client: z.enum(['app', 'web']).default('web'),
});
export const adminLoginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().optional() });
export const updateMeSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80).optional(),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .max(120)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  notifyOrders: z.boolean().optional(),
  notifyOffers: z.boolean().optional(),
});
export const deleteAccountSchema = z.object({ confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm' }) }) });
export const pushTokenSchema = z.object({ token: z.string().min(1).nullable() });

// ---------- areas & users ----------
export const areaFeesSchema = z.object({
  minOrderPaise: paise,
  deliveryFeePaise: paise,
  freeDeliveryAbovePaise: paise,
  autoRefundLimitPaise: paise,
  demandBufferPct: z.number().int().min(0).max(100),
});
export const areaCreateSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, '2-6 letters, e.g. JBP'),
    name: z.string().trim().min(2),
    city: z.string().trim().min(2),
    isActive: z.boolean().default(true),
    pincodes: z.array(pincodeSchema).default([]),
  })
  .merge(areaFeesSchema.partial());
export const areaUpdateSchema = areaCreateSchema.partial();
export const areaSettingsSchema = areaFeesSchema.partial();

export const adminCreateSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(2),
  areaId: id,
});
export const adminUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  areaId: id.optional(),
  status: enumOf(UserStatus).optional(),
});

export const vendorProfileSchema = z.object({
  businessName: z.string().trim().min(2),
  gstin: z.string().trim().optional().nullable(),
  bankAccount: z.string().trim().optional().nullable(),
  ifsc: z.string().trim().optional().nullable(),
  upiId: z.string().trim().optional().nullable(),
});
export const staffCreateSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(2),
  role: z.enum(['MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR']),
  vendor: vendorProfileSchema.optional(),
});
export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(['MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR']).optional(),
  status: enumOf(UserStatus).optional(),
  vendor: vendorProfileSchema.partial().optional(),
});

// ---------- catalog ----------
export const categoryUpsertSchema = z.object({
  name: z.string().trim().min(2),
  imageUrl: z.string().url().nullable().optional(),
  sort: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export const variantInputSchema = z.object({
  id: id.optional(),
  label: z.string().trim().min(1),
  baseQty: z.number().int().positive(),
  pricePaise: paise,
  mrpPaise: paise,
  isActive: z.boolean().default(true),
});
export const itemUpsertSchema = z.object({
  categoryId: id,
  name: z.string().trim().min(2),
  description: z.string().trim().max(1000).nullable().optional(),
  images: z.array(z.string().url()).default([]),
  unitType: unitTypeSchema,
  hsnCode: z.string().trim().nullable().optional(),
  gstRate: z.number().int().min(0).max(28).default(0),
  isActive: z.boolean().default(true),
  sourceNote: z.string().trim().max(120).nullable().optional(),
  variants: z.array(variantInputSchema).min(1, 'Add at least one pack size'),
});
export const priceBoardSchema = z.object({
  rows: z.array(z.object({ variantId: id, pricePaise: paise, mrpPaise: paise, isActive: z.boolean().optional() })).min(1),
});
export const stockBoardSchema = z.object({
  date: ymdSchema,
  rows: z.array(z.object({ itemId: id, availableQty: z.number().int().min(0) })).min(1),
});
export const stockCopySchema = z.object({ fromDate: ymdSchema, toDate: ymdSchema });
export const wastageSchema = z.object({ itemId: id, qty: z.number().int().positive(), note: z.string().optional() });
export const bannerUpsertSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().nullable().optional(),
  imageUrl: z.string().url(),
  sort: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// ---------- slots & coupons ----------
export const slotUpsertSchema = z.object({
  label: z.string().trim().min(2),
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  cutoffMinutesBefore: z.number().int().min(0).max(48 * 60),
  capacity: z.number().int().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
});
export const couponUpsertSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/),
  description: z.string().trim().nullable().optional(),
  type: enumOf(CouponType),
  value: z.number().int().positive(),
  maxDiscountPaise: paise.nullable().optional(),
  minOrderPaise: paise.default(0),
  validFrom: ymdSchema,
  validTo: ymdSchema,
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
});

// ---------- customer ----------
export const addressUpsertSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  name: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3).max(200),
  landmark: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  isDefault: z.boolean().default(false),
});
export const cartSetSchema = z.object({ variantId: id, qty: z.number().int().min(0).max(50) });
export const quoteSchema = z.object({ addressId: id, couponCode: z.string().trim().toUpperCase().optional().nullable() });
export const placeOrderSchema = z.object({
  addressId: id,
  slotId: id,
  slotDate: ymdSchema,
  couponCode: z.string().trim().toUpperCase().optional().nullable(),
  paymentMode: z.enum(['RAZORPAY', 'COD']),
  channel: z.enum(['APP', 'WEB']).default('WEB'),
  note: z.string().trim().max(200).optional(),
});
export const verifyPaymentSchema = z.object({
  orderId: id,
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
export const cancelSchema = z.object({ reason: z.string().trim().min(2).max(200) });
export const ratingSchema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });
export const issueCreateSchema = z.object({
  orderItemId: id.optional(),
  type: enumOf(IssueType),
  description: z.string().trim().max(500).optional(),
  photoUrl: z.string().url().optional(),
});

// ---------- operations ----------
export const statusChangeSchema = z.object({ status: orderStatusSchema, note: z.string().trim().max(200).optional() });
export const packSchema = z.object({
  items: z.array(z.object({ orderItemId: id, packedQty: z.number().int().min(0) })),
});
export const dispatchSchema = z.object({ orderIds: z.array(id).min(1), riderId: id });
export const posOrderSchema = z.object({
  items: z.array(z.object({ variantId: id, qty: z.number().int().positive() })).min(1),
  paymentMode: z.enum(['CASH', 'UPI']),
  customerPhone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  customerName: z.string().trim().max(80).optional(),
  discountPaise: paise.default(0),
});
export const riderOnlineSchema = z.object({ isOnline: z.boolean() });
export const deliverSchema = z.object({
  rejections: z
    .array(
      z.object({
        orderItemId: id,
        qty: z.number().int().positive(),
        reason: z.string().trim().min(2).max(100),
        photoUrl: z.string().url().optional(),
      }),
    )
    .default([]),
  codCollectedPaise: paise.optional(),
});

// ---------- supply ----------
export const vendorRatesSchema = z.object({
  date: ymdSchema,
  rates: z.array(z.object({ itemId: id, ratePaise: z.number().int().positive() })).min(1),
});
export const poCreateSchema = z.object({
  vendorId: id,
  forDate: ymdSchema,
  note: z.string().trim().max(200).optional(),
  items: z.array(z.object({ itemId: id, orderedQty: z.number().int().positive(), ratePaise: paise })).min(1),
});
export const poRespondSchema = z.object({
  action: z.enum(['ACCEPT', 'ADJUST', 'REJECT']),
  note: z.string().trim().max(200).optional(),
  items: z
    .array(z.object({ poItemId: id, acceptedQty: z.number().int().min(0), ratePaise: paise.optional() }))
    .default([]),
});
export const poReceiveSchema = z.object({
  items: z.array(z.object({ poItemId: id, receivedQty: z.number().int().min(0) })).min(1),
  addToStockDate: ymdSchema.nullable().optional(),
});

// ---------- accounts ----------
export const codSettleSchema = z.object({
  date: ymdSchema,
  depositedPaise: paise,
  note: z.string().trim().max(200).optional(),
});
export const vendorPaymentSchema = z.object({
  amountPaise: z.number().int().positive(),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
});
export const refundDecisionSchema = z.object({ note: z.string().trim().max(200).optional() });
export const issueResolveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  refundPaise: paise.optional(),
  note: z.string().trim().max(200).optional(),
});
export const dateRangeSchema = z.object({ from: ymdSchema, to: ymdSchema });

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type AreaCreateInput = z.infer<typeof areaCreateSchema>;
export type AreaSettingsInput = z.infer<typeof areaSettingsSchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;
export type ItemUpsertInput = z.infer<typeof itemUpsertSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type SlotUpsertInput = z.infer<typeof slotUpsertSchema>;
export type CouponUpsertInput = z.infer<typeof couponUpsertSchema>;
export type BannerUpsertInput = z.infer<typeof bannerUpsertSchema>;
export type AddressUpsertInput = z.infer<typeof addressUpsertSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PosOrderInput = z.infer<typeof posOrderSchema>;
export type DeliverInput = z.infer<typeof deliverSchema>;
export type PoCreateInput = z.infer<typeof poCreateSchema>;
export type PoRespondInput = z.infer<typeof poRespondSchema>;
export type PoReceiveInput = z.infer<typeof poReceiveSchema>;
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
