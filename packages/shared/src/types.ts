import type {
  CashStatus,
  CouponType,
  IssueStatus,
  IssueType,
  LedgerType,
  OrderChannel,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  PoStatus,
  RefundSource,
  RefundStatus,
  Role,
  UnitType,
  UserStatus,
} from './enums';

/** Response shapes shared by the API and both clients. Dates are ISO strings, days are "YYYY-MM-DD". */

export interface AreaRef {
  id: string;
  code: string;
  name: string;
  city: string;
}

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  areaId: string | null;
  area: AreaRef | null;
  isOnline: boolean;
  email: string | null;
  notifyOrders: boolean;
  notifyOffers: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Area extends AreaRef {
  isActive: boolean;
  minOrderPaise: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number;
  autoRefundLimitPaise: number;
  demandBufferPct: number;
  pincodes: string[];
  admin?: { id: string; name: string | null; phone: string; status: UserStatus } | null;
  createdAt: string;
}

export interface VendorProfile {
  id: string;
  businessName: string;
  gstin: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  upiId: string | null;
}

export interface StaffUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  areaId: string | null;
  isOnline: boolean;
  vendor: VendorProfile | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string | null;
  sort: number;
  isActive: boolean;
  itemCount?: number;
}

export interface Variant {
  id: string;
  label: string;
  baseQty: number;
  pricePaise: number;
  mrpPaise: number;
  isActive: boolean;
}

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  images: string[];
  unitType: UnitType;
  hsnCode: string | null;
  gstRate: number;
  isActive: boolean;
  sourceNote: string | null;
  variants: Variant[];
}

/** Item as the customer sees it for a delivery date. remainingQty is in base units; 0 = sold out. */
export interface CatalogItem extends Item {
  remainingQty: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  sort: number;
  isActive: boolean;
}

export interface CatalogHome {
  area: AreaRef & { minOrderPaise: number; deliveryFeePaise: number; freeDeliveryAbovePaise: number };
  deliveryDate: string;
  nextSlot: SlotOption | null;
  banners: Banner[];
  categories: Category[];
  freshPicks: CatalogItem[];
}

export interface StockRow {
  itemId: string;
  name: string;
  unitType: UnitType;
  categoryName: string;
  availableQty: number;
  reservedQty: number;
  remainingQty: number;
  hasRow: boolean;
}

export interface DeliverySlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  cutoffMinutesBefore: number;
  capacity: number;
  daysOfWeek: number[];
  isActive: boolean;
  sort: number;
}

export interface SlotOption {
  slotId: string;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  cutoffAt: string;
  remaining: number;
  available: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  isActive: boolean;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  landmark: string | null;
  city: string;
  pincode: string;
  areaId: string | null;
  isDefault: boolean;
  serviceable: boolean;
}

export interface CartLine {
  variantId: string;
  qty: number;
  itemId: string;
  name: string;
  image: string | null;
  unitType: UnitType;
  variantLabel: string;
  baseQty: number;
  pricePaise: number;
  mrpPaise: number;
  available: boolean;
}

export interface Cart {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
}

export interface Quote {
  lines: CartLine[];
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  meetsMinOrder: boolean;
  minOrderPaise: number;
  amountToFreeDeliveryPaise: number;
  coupon: { code: string; valid: boolean; message: string | null } | null;
  slots: SlotOption[];
}

export interface OrderItem {
  id: string;
  itemId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  unitType: UnitType;
  baseQty: number;
  qty: number;
  packedQty: number | null;
  rejectedQty: number;
  rejectReason: string | null;
  rejectPhotoUrl: string | null;
  pricePaise: number;
  image: string | null;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  orderNo?: string;
  source: RefundSource;
  amountPaise: number;
  reason: string | null;
  status: RefundStatus;
  auto: boolean;
  approvedByName?: string | null;
  createdAt: string;
  processedAt: string | null;
  paymentMode?: PaymentMode;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface OrderSummary {
  id: string;
  orderNo: string;
  status: OrderStatus;
  channel: OrderChannel;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  finalPayablePaise: number;
  slotDate: string | null;
  slotLabel: string | null;
  itemCount: number;
  customerName: string | null;
  customerPhone: string | null;
  pincode: string | null;
  riderId: string | null;
  riderName: string | null;
  createdAt: string;
  previewImages: string[];
}

export interface OrderDetail extends OrderSummary {
  areaId: string;
  address: {
    name: string;
    phone: string;
    line1: string;
    landmark: string | null;
    city: string;
    pincode: string;
    lat: number | null;
    lng: number | null;
  } | null;
  slot: { id: string; label: string; startTime: string; endTime: string } | null;
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  couponCode: string | null;
  codCollectedPaise: number | null;
  invoiceNo: string | null;
  cancelReason: string | null;
  note: string | null;
  items: OrderItem[];
  events: OrderEvent[];
  refunds: Refund[];
  rating: { stars: number; comment: string | null } | null;
  issues: IssueReport[];
  canCancel: boolean;
  canRate: boolean;
  canReportIssue: boolean;
  razorpay: RazorpayCheckout | null;
}

export interface RazorpayCheckout {
  mock: boolean;
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: 'INR';
  name: string;
  description: string;
  prefill: { name: string; contact: string };
}

export interface PlaceOrderResponse {
  order: OrderDetail;
  razorpay: RazorpayCheckout | null;
}

export interface IssueReport {
  id: string;
  orderId: string;
  orderNo?: string;
  orderItemId: string | null;
  itemName: string | null;
  type: IssueType;
  description: string | null;
  photoUrl: string | null;
  status: IssueStatus;
  refundId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
}

export interface PickListRow {
  itemId: string;
  name: string;
  unitType: UnitType;
  totalBaseQty: number;
  orders: number;
  variants: { label: string; qty: number }[];
}

export interface Rider {
  id: string;
  name: string | null;
  phone: string;
  isOnline: boolean;
  assignedCount: number;
}

export interface RiderCashSummary {
  date: string;
  codExpectedPaise: number;
  depositedPaise: number;
  status: CashStatus;
  deliveredCount: number;
}

export interface VendorRate {
  itemId: string;
  name: string;
  unitType: UnitType;
  ratePaise: number | null;
}

export interface PoItem {
  id: string;
  itemId: string;
  name: string;
  unitType: UnitType;
  orderedQty: number;
  acceptedQty: number | null;
  receivedQty: number | null;
  ratePaise: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  vendorId: string;
  vendorName: string;
  forDate: string;
  status: PoStatus;
  note: string | null;
  vendorNote: string | null;
  items: PoItem[];
  totalPaise: number;
  createdAt: string;
}

export interface DemandRow {
  itemId: string;
  name: string;
  unitType: UnitType;
  orderedBaseQty: number;
  bufferBaseQty: number;
  requiredBaseQty: number;
  alreadyPoBaseQty: number;
  bestRate: { vendorId: string; vendorName: string; ratePaise: number } | null;
  rates: { vendorId: string; vendorName: string; ratePaise: number }[];
}

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  amountPaise: number;
  poNo: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export interface VendorBalance {
  vendorId: string;
  userId: string;
  businessName: string;
  phone: string;
  payablePaise: number;
  paidPaise: number;
  balancePaise: number;
}

export interface CodRow {
  riderId: string;
  riderName: string | null;
  phone: string;
  date: string;
  deliveredCount: number;
  codExpectedPaise: number;
  depositedPaise: number;
  status: CashStatus;
  note: string | null;
}

export interface SalesReport {
  from: string;
  to: string;
  totals: {
    orders: number;
    grossPaise: number;
    discountPaise: number;
    deliveryFeePaise: number;
    refundsPaise: number;
    netPaise: number;
  };
  byDay: { date: string; orders: number; netPaise: number }[];
  byPaymentMode: { mode: PaymentMode; orders: number; netPaise: number }[];
  byChannel: { channel: OrderChannel; orders: number; netPaise: number }[];
  topItems: { itemId: string; name: string; unitType: UnitType; baseQty: number; revenuePaise: number }[];
}

export interface DashboardSummary {
  date: string;
  ordersBySlot: { slotId: string | null; label: string; count: number }[];
  statusCounts: Partial<Record<OrderStatus, number>>;
  revenuePaise: number;
  ordersCount: number;
  soldOutItems: { itemId: string; name: string }[];
  pendingRefunds: number;
  openIssues: number;
  onlineRiders: number;
  avgRating: number | null;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Rating {
  id: string;
  orderId: string;
  orderNo: string;
  stars: number;
  comment: string | null;
  customerName: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
