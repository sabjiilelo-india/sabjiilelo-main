import type { Prisma } from '@prisma/client';
import type {
  Area,
  AuthUser,
  Category,
  Coupon,
  DeliverySlot,
  Item,
  StaffUser,
  Banner,
  Address,
  Refund,
  IssueReport,
} from '@sabjiilelo/shared';
import { iso, ymd } from './http';

export const userWithArea = { area: { select: { id: true, code: true, name: true, city: true } } } satisfies Prisma.UserInclude;
type UserWithArea = Prisma.UserGetPayload<{ include: typeof userWithArea }>;

export function toAuthUser(u: UserWithArea): AuthUser {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    status: u.status,
    areaId: u.areaId,
    area: u.area,
    isOnline: u.isOnline,
    email: u.email,
    notifyOrders: u.notifyOrders,
    notifyOffers: u.notifyOffers,
    createdAt: u.createdAt.toISOString(),
  };
}

export const areaInclude = {
  pincodes: { select: { pincode: true }, orderBy: { pincode: 'asc' } },
  users: { where: { role: 'ADMIN' }, select: { id: true, name: true, phone: true, status: true }, take: 1 },
} satisfies Prisma.AreaInclude;
type AreaFull = Prisma.AreaGetPayload<{ include: typeof areaInclude }>;

export function toArea(a: AreaFull): Area {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    city: a.city,
    isActive: a.isActive,
    minOrderPaise: a.minOrderPaise,
    deliveryFeePaise: a.deliveryFeePaise,
    freeDeliveryAbovePaise: a.freeDeliveryAbovePaise,
    autoRefundLimitPaise: a.autoRefundLimitPaise,
    demandBufferPct: a.demandBufferPct,
    pincodes: a.pincodes.map((p) => p.pincode),
    admin: a.users[0] ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export const staffInclude = { vendor: true } satisfies Prisma.UserInclude;
type StaffFull = Prisma.UserGetPayload<{ include: typeof staffInclude }>;

export function toStaff(u: StaffFull): StaffUser {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    status: u.status,
    areaId: u.areaId,
    isOnline: u.isOnline,
    vendor: u.vendor
      ? {
          id: u.vendor.id,
          businessName: u.vendor.businessName,
          gstin: u.vendor.gstin,
          bankAccount: u.vendor.bankAccount,
          ifsc: u.vendor.ifsc,
          upiId: u.vendor.upiId,
        }
      : null,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: iso(u.lastLoginAt),
  };
}

export function toCategory(c: Prisma.CategoryGetPayload<{ include: { _count: { select: { items: true } } } }> | Prisma.CategoryGetPayload<object>): Category {
  return {
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    sort: c.sort,
    isActive: c.isActive,
    itemCount: '_count' in c ? (c as { _count: { items: number } })._count.items : undefined,
  };
}

export const itemInclude = { variants: { orderBy: [{ sort: 'asc' }, { baseQty: 'asc' }] } } satisfies Prisma.ItemInclude;
type ItemFull = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

export function toItem(i: ItemFull, opts: { activeVariantsOnly?: boolean } = {}): Item {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    description: i.description,
    images: i.images,
    unitType: i.unitType,
    hsnCode: i.hsnCode,
    gstRate: i.gstRate,
    isActive: i.isActive,
    sourceNote: i.sourceNote,
    variants: i.variants
      .filter((v) => !opts.activeVariantsOnly || v.isActive)
      .map((v) => ({ id: v.id, label: v.label, baseQty: v.baseQty, pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, isActive: v.isActive })),
  };
}

export function toSlot(s: Prisma.DeliverySlotGetPayload<object>): DeliverySlot {
  return {
    id: s.id,
    label: s.label,
    startTime: s.startTime,
    endTime: s.endTime,
    cutoffMinutesBefore: s.cutoffMinutesBefore,
    capacity: s.capacity,
    daysOfWeek: s.daysOfWeek,
    isActive: s.isActive,
    sort: s.sort,
  };
}

export function toCoupon(c: Prisma.CouponGetPayload<object>): Coupon {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    maxDiscountPaise: c.maxDiscountPaise,
    minOrderPaise: c.minOrderPaise,
    validFrom: ymd(c.validFrom)!,
    validTo: ymd(c.validTo)!,
    usageLimit: c.usageLimit,
    perUserLimit: c.perUserLimit,
    usedCount: c.usedCount,
    isActive: c.isActive,
  };
}

export function toBanner(b: Prisma.BannerGetPayload<object>): Banner {
  return { id: b.id, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, sort: b.sort, isActive: b.isActive };
}

export function toAddress(a: Prisma.AddressGetPayload<object>, serviceable: boolean): Address {
  return {
    id: a.id,
    label: a.label,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    landmark: a.landmark,
    city: a.city,
    pincode: a.pincode,
    areaId: a.areaId,
    isDefault: a.isDefault,
    serviceable,
  };
}

export function toRefund(
  r: Prisma.RefundGetPayload<object> & {
    order?: { orderNo: string; paymentMode: Refund['paymentMode']; customerName: string | null; customerPhone: string | null };
  },
): Refund {
  return {
    id: r.id,
    orderId: r.orderId,
    orderNo: r.order?.orderNo,
    source: r.source,
    amountPaise: r.amountPaise,
    reason: r.reason,
    status: r.status,
    auto: r.auto,
    approvedByName: r.approvedByName,
    createdAt: r.createdAt.toISOString(),
    processedAt: iso(r.processedAt),
    paymentMode: r.order?.paymentMode,
    customerName: r.order?.customerName,
    customerPhone: r.order?.customerPhone,
  };
}

export function toIssue(
  i: Prisma.IssueReportGetPayload<{ include: { orderItem: { select: { name: true } } } }> & {
    order?: { orderNo: string; customerName: string | null; customerPhone: string | null };
  },
): IssueReport {
  return {
    id: i.id,
    orderId: i.orderId,
    orderNo: i.order?.orderNo,
    orderItemId: i.orderItemId,
    itemName: i.orderItem?.name ?? null,
    type: i.type,
    description: i.description,
    photoUrl: i.photoUrl,
    status: i.status,
    refundId: i.refundId,
    customerName: i.order?.customerName,
    customerPhone: i.order?.customerPhone,
    createdAt: i.createdAt.toISOString(),
  };
}
