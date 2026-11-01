import type { z } from 'zod';
import type * as S from '@sabjiilelo/shared';
import type {
  Address,
  Area,
  AreaRef,
  AuthResponse,
  AuthUser,
  Banner,
  Cart,
  CatalogHome,
  CatalogItem,
  Category,
  CodRow,
  Coupon,
  DashboardSummary,
  DeliverySlot,
  DemandRow,
  IssueReport,
  Item,
  LedgerEntry,
  Notification,
  OrderDetail,
  OrderSummary,
  Paginated,
  PickListRow,
  PlaceOrderResponse,
  PurchaseOrder,
  Quote,
  Rating,
  Refund,
  Rider,
  RiderCashSummary,
  SalesReport,
  SlotOption,
  StaffUser,
  StockRow,
  VendorBalance,
  VendorProfile,
  VendorRate,
} from '@sabjiilelo/shared';
import type { Http } from './http';

type In<T extends z.ZodTypeAny> = z.input<T>;

export interface AreaOverview extends Area {
  staffCount: number;
  todayOrders: number;
  todayRevenuePaise: number;
}

export interface AdminUser extends StaffUser {
  area: AreaRef | null;
}

export type ManageItem = Item & { categoryName: string };

export interface StockMovementRow {
  id: string;
  itemName: string;
  unitType: S.UnitType;
  type: S.StockMovementType;
  qty: number;
  note: string | null;
  refType: string | null;
  createdAt: string;
}

export interface AccountIssue extends IssueReport {
  paymentMode: S.PaymentMode;
  suggestedRefundPaise: number;
}

export function createEndpoints(http: Http) {
  return {
    auth: {
      requestOtp: (phone: string) => http.post<{ expiresInSec: number; devHint?: string }>('/auth/otp/request', { phone }),
      verifyOtp: (phone: string, code: string) => http.post<AuthResponse>('/auth/otp/verify', { phone, code, client: http.config.client }),
      adminLogin: (username: string, password: string) => http.post<AuthResponse>('/auth/admin/login', { username, password }),
      me: () => http.get<AuthUser>('/auth/me'),
      updateMe: (name: string) => http.patch<AuthUser>('/auth/me', { name }),
      logout: (refreshToken?: string | null) => http.post<{ ok: true }>('/auth/logout', { refreshToken }),
      pushToken: (token: string | null) => http.post<{ ok: true }>('/auth/push-token', { token }),
    },

    catalog: {
      serviceability: (pincode: string) => http.get<{ serviceable: boolean; area: AreaRef | null }>('/catalog/serviceability', { pincode }),
      home: (areaId: string) => http.get<CatalogHome>('/catalog/home', { areaId }),
      items: (areaId: string, opts: { categoryId?: string; q?: string; date?: string } = {}) =>
        http.get<{ date: string; items: CatalogItem[] }>('/catalog/items', { areaId, ...opts }),
      item: (id: string) => http.get<{ date: string; item: CatalogItem }>(`/catalog/items/${id}`),
      slots: (areaId: string) => http.get<SlotOption[]>('/catalog/slots', { areaId }),
    },

    me: {
      addresses: () => http.get<Address[]>('/me/addresses'),
      createAddress: (body: In<typeof S.addressUpsertSchema>) => http.post<Address>('/me/addresses', body),
      updateAddress: (id: string, body: In<typeof S.addressUpsertSchema>) => http.put<Address>(`/me/addresses/${id}`, body),
      deleteAddress: (id: string) => http.del<{ ok: true }>(`/me/addresses/${id}`),
      cart: (areaId: string) => http.get<Cart>('/me/cart', { areaId }),
      setCart: (variantId: string, qty: number) => http.put<Cart>('/me/cart', { variantId, qty }),
      clearCart: () => http.del<{ ok: true }>('/me/cart'),
      coupons: (areaId: string) => http.get<Coupon[]>('/me/coupons', { areaId }),
      quote: (addressId: string, couponCode?: string | null) => http.post<Quote>('/me/checkout/quote', { addressId, couponCode }),
      placeOrder: (body: In<typeof S.placeOrderSchema>) => http.post<PlaceOrderResponse>('/me/orders', body),
      orders: (page = 1) => http.get<Paginated<OrderSummary>>('/me/orders', { page }),
      order: (id: string) => http.get<OrderDetail>(`/me/orders/${id}`),
      cancel: (id: string, reason: string) => http.post<OrderDetail>(`/me/orders/${id}/cancel`, { reason }),
      reorder: (id: string) => http.post<{ added: number; skipped: number }>(`/me/orders/${id}/reorder`),
      rate: (id: string, stars: number, comment?: string) => http.post<OrderDetail>(`/me/orders/${id}/rating`, { stars, comment }),
      reportIssue: (id: string, body: In<typeof S.issueCreateSchema>) => http.post<OrderDetail>(`/me/orders/${id}/issues`, body),
    },

    payments: {
      verify: (body: In<typeof S.verifyPaymentSchema>) => http.post<OrderDetail>('/payments/verify', body),
      mockCheckout: (razorpayOrderId: string) =>
        http.post<{ razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }>('/payments/mock-checkout', { razorpayOrderId }),
    },

    superadmin: {
      overview: () => http.get<{ customers: number; areas: AreaOverview[] }>('/superadmin/overview'),
      areas: () => http.get<Area[]>('/areas'),
      createArea: (body: In<typeof S.areaCreateSchema>) => http.post<Area>('/areas', body),
      updateArea: (id: string, body: In<typeof S.areaUpdateSchema>) => http.patch<Area>(`/areas/${id}`, body),
      admins: () => http.get<AdminUser[]>('/admins'),
      createAdmin: (body: In<typeof S.adminCreateSchema>) => http.post<StaffUser>('/admins', body),
      updateAdmin: (id: string, body: In<typeof S.adminUpdateSchema>) => http.patch<StaffUser>(`/admins/${id}`, body),
    },

    area: {
      get: () => http.get<Area>('/area'),
      updateSettings: (body: In<typeof S.areaSettingsSchema>) => http.patch<Area>('/area/settings', body),
    },

    staff: {
      list: (role?: S.Role) => http.get<StaffUser[]>('/staff', { role }),
      create: (body: In<typeof S.staffCreateSchema>) => http.post<StaffUser>('/staff', body),
      update: (id: string, body: In<typeof S.staffUpdateSchema>) => http.patch<StaffUser>(`/staff/${id}`, body),
    },

    manage: {
      categories: () => http.get<Category[]>('/manage/categories'),
      createCategory: (body: In<typeof S.categoryUpsertSchema>) => http.post<Category>('/manage/categories', body),
      updateCategory: (id: string, body: Partial<In<typeof S.categoryUpsertSchema>>) => http.patch<Category>(`/manage/categories/${id}`, body),
      items: (opts: { categoryId?: string; q?: string } = {}) => http.get<ManageItem[]>('/manage/items', opts),
      item: (id: string) => http.get<Item>(`/manage/items/${id}`),
      createItem: (body: In<typeof S.itemUpsertSchema>) => http.post<Item>('/manage/items', body),
      updateItem: (id: string, body: In<typeof S.itemUpsertSchema>) => http.put<Item>(`/manage/items/${id}`, body),
      setItemActive: (id: string, isActive: boolean) => http.patch<Item>(`/manage/items/${id}/active`, { isActive }),
      savePrices: (body: In<typeof S.priceBoardSchema>) => http.put<{ ok: true; updated: number }>('/manage/prices', body),
      stock: (date: string) => http.get<{ date: string; rows: StockRow[] }>('/manage/stock', { date }),
      saveStock: (body: In<typeof S.stockBoardSchema>) => http.put<{ ok: true }>('/manage/stock', body),
      copyStock: (fromDate: string, toDate: string) => http.post<{ copied: number; skipped: number }>('/manage/stock/copy', { fromDate, toDate }),
      wastage: (body: In<typeof S.wastageSchema>, date?: string) => http.post<{ ok: true }>('/manage/stock/wastage', body, { date }),
      movements: (page = 1) => http.get<Paginated<StockMovementRow>>('/manage/stock/movements', { page }),
      slots: () => http.get<DeliverySlot[]>('/manage/slots'),
      createSlot: (body: In<typeof S.slotUpsertSchema>) => http.post<DeliverySlot>('/manage/slots', body),
      updateSlot: (id: string, body: In<typeof S.slotUpsertSchema>) => http.put<DeliverySlot>(`/manage/slots/${id}`, body),
      coupons: () => http.get<Coupon[]>('/manage/coupons'),
      createCoupon: (body: In<typeof S.couponUpsertSchema>) => http.post<Coupon>('/manage/coupons', body),
      updateCoupon: (id: string, body: In<typeof S.couponUpsertSchema>) => http.put<Coupon>(`/manage/coupons/${id}`, body),
      banners: () => http.get<Banner[]>('/manage/banners'),
      createBanner: (body: In<typeof S.bannerUpsertSchema>) => http.post<Banner>('/manage/banners', body),
      updateBanner: (id: string, body: In<typeof S.bannerUpsertSchema>) => http.put<Banner>(`/manage/banners/${id}`, body),
      deleteBanner: (id: string) => http.del<{ ok: true }>(`/manage/banners/${id}`),
      ratings: (page = 1) => http.get<Paginated<Rating> & { average: number | null }>('/manage/ratings', { page }),
    },

    ops: {
      orders: (opts: { date?: string; slotId?: string; status?: string; pincode?: string; q?: string; channel?: string; riderId?: string; page?: number; pageSize?: number } = {}) =>
        http.get<Paginated<OrderSummary>>('/ops/orders', opts),
      order: (id: string) => http.get<OrderDetail>(`/ops/orders/${id}`),
      setStatus: (id: string, status: S.OrderStatus, note?: string) => http.post<OrderDetail>(`/ops/orders/${id}/status`, { status, note }),
      bulkConfirm: (orderIds: string[]) => http.post<{ confirmed: number }>('/ops/orders/bulk-confirm', { orderIds }),
      pack: (id: string, items: { orderItemId: string; packedQty: number }[]) => http.post<OrderDetail>(`/ops/orders/${id}/pack`, { items }),
      cancel: (id: string, reason: string) => http.post<OrderDetail>(`/ops/orders/${id}/cancel`, { reason }),
      dispatch: (orderIds: string[], riderId: string) => http.post<{ assigned: number }>('/ops/dispatch', { orderIds, riderId }),
      riders: (date?: string) => http.get<Rider[]>('/ops/riders', { date }),
      picklist: (date: string, slotId?: string) => http.get<{ date: string; rows: PickListRow[] }>('/ops/picklist', { date, slotId }),
      pos: (body: In<typeof S.posOrderSchema>) => http.post<OrderDetail>('/ops/pos/orders', body),
    },

    invoices: {
      url: (orderId: string, kind: 'bill' | 'packing-slip' = 'bill') => http.url(`/invoices/${orderId}/${kind}.pdf`),
      download: (orderId: string, kind: 'bill' | 'packing-slip' = 'bill') => http.blob(`/invoices/${orderId}/${kind}.pdf`),
    },

    rider: {
      setOnline: (isOnline: boolean) => http.post<{ isOnline: boolean }>('/rider/online', { isOnline }),
      orders: (scope: 'active' | 'done' = 'active', date?: string) => http.get<OrderSummary[]>('/rider/orders', { scope, date }),
      order: (id: string) => http.get<OrderDetail>(`/rider/orders/${id}`),
      start: (id: string) => http.post<OrderDetail>(`/rider/orders/${id}/start`),
      deliver: (id: string, body: In<typeof S.deliverSchema>) => http.post<OrderDetail>(`/rider/orders/${id}/deliver`, body),
      cash: (date?: string) => http.get<RiderCashSummary>('/rider/cash', { date }),
    },

    vendor: {
      profile: () => http.get<VendorProfile & { areaId: string; area: AreaRef }>('/vendor/profile'),
      rates: (date: string) => http.get<{ date: string; rates: VendorRate[] }>('/vendor/rates', { date }),
      saveRates: (body: In<typeof S.vendorRatesSchema>) => http.put<{ ok: true; saved: number }>('/vendor/rates', body),
      pos: (status?: string) => http.get<PurchaseOrder[]>('/vendor/pos', { status }),
      po: (id: string) => http.get<PurchaseOrder>(`/vendor/pos/${id}`),
      respond: (id: string, body: In<typeof S.poRespondSchema>) => http.post<PurchaseOrder>(`/vendor/pos/${id}/respond`, body),
      ledger: () => http.get<{ payablePaise: number; paidPaise: number; balancePaise: number; entries: LedgerEntry[] }>('/vendor/ledger'),
    },

    supply: {
      demand: (date: string) => http.get<{ date: string; bufferPct: number; rows: DemandRow[] }>('/supply/demand', { date }),
      vendors: () => http.get<{ id: string; businessName: string; phone: string; contactName: string | null }[]>('/supply/vendors'),
      pos: (opts: { date?: string; vendorId?: string; status?: string } = {}) => http.get<PurchaseOrder[]>('/supply/pos', opts),
      po: (id: string) => http.get<PurchaseOrder>(`/supply/pos/${id}`),
      createPo: (body: In<typeof S.poCreateSchema>) => http.post<PurchaseOrder>('/supply/pos', body),
      receive: (id: string, body: In<typeof S.poReceiveSchema>) => http.post<PurchaseOrder>(`/supply/pos/${id}/receive`, body),
      close: (id: string) => http.post<PurchaseOrder>(`/supply/pos/${id}/close`),
    },

    accounts: {
      cod: (date: string) => http.get<{ date: string; rows: CodRow[]; totals: { expectedPaise: number; depositedPaise: number } }>('/accounts/cod', { date }),
      settleCod: (riderId: string, body: In<typeof S.codSettleSchema>) => http.post<unknown>(`/accounts/cod/${riderId}/settle`, body),
      vendors: () => http.get<VendorBalance[]>('/accounts/vendors'),
      vendorLedger: (vendorId: string) =>
        http.get<{ vendor: { id: string; businessName: string; bankAccount: string | null; ifsc: string | null; upiId: string | null }; entries: LedgerEntry[] }>(
          `/accounts/vendors/${vendorId}/ledger`,
        ),
      payVendor: (vendorId: string, body: In<typeof S.vendorPaymentSchema>) => http.post<LedgerEntry>(`/accounts/vendors/${vendorId}/payments`, body),
      refunds: (status: S.RefundStatus | 'ALL' = 'REQUESTED') => http.get<Refund[]>('/accounts/refunds', { status }),
      approveRefund: (id: string, note?: string) => http.post<Refund>(`/accounts/refunds/${id}/approve`, { note }),
      rejectRefund: (id: string, note?: string) => http.post<Refund>(`/accounts/refunds/${id}/reject`, { note }),
      issues: (status: S.IssueStatus | 'ALL' = 'OPEN') => http.get<AccountIssue[]>('/accounts/issues', { status }),
      resolveIssue: (id: string, body: In<typeof S.issueResolveSchema>) => http.post<{ ok: true }>(`/accounts/issues/${id}/resolve`, body),
    },

    reports: {
      dashboard: (date?: string) => http.get<DashboardSummary & { activeOrders: number }>('/reports/dashboard', { date }),
      sales: (from: string, to: string) => http.get<SalesReport>('/reports/sales', { from, to }),
      csv: (kind: 'orders' | 'items' | 'purchases', from: string, to: string) => http.blob(`/reports/${kind}.csv`, { from, to }),
    },

    notifications: {
      list: (page = 1) => http.get<Paginated<Notification> & { unread: number }>('/notifications', { page }),
      markRead: (ids?: string[]) => http.post<{ ok: true }>('/notifications/read', { ids }),
    },

    uploads: {
      image: (folder: 'items' | 'categories' | 'banners' | 'proofs' | 'issues', form: FormData) => http.upload<{ url: string }>(`/uploads/${folder}`, form),
    },
  };
}

export type Api = ReturnType<typeof createEndpoints>;
