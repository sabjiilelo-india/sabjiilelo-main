# Sabjiilelo — MVP Plan (v2, refined)

> Step 0 of implementation: copy this file into the repo as `docs/PLAN.md` and keep it updated as the source of truth.

## Context
Greenfield project (the repo only holds `THEME.md`). Sabjiilelo is a fruit and vegetable delivery business. It works on **scheduled slots** and uses a **supplier/inventory model**: vendors supply us, customers buy from Sabjiilelo, and we control price and quality. Its standout feature is the **freshness promise**: the customer can reject a bad item at the door. Operations are split by **area** (a city plus its pincodes), and each area has one admin who runs its staff. One backend serves a React web app (all roles, including a customer shop) and one Expo app (customer, vendor and delivery boy). The MVP target is about 10 weeks, English-first, hosted on Render.

### Why React (Vite) + Express + Postgres + Expo works well
- **Web**: the staff portal is dashboards and the customer shop sits behind a login, so neither needs server rendering. A Vite SPA is fast to build and costs almost nothing to host as a static site.
- **Shared code**: web and Expo are both React. They share **TS types, zod schemas, the API client, TanStack Query hooks, the permission matrix and theme tokens** through monorepo packages. A change to an API contract becomes a compile error in both clients, which keeps them in sync.
- **Separate Express API**: one source of truth for both clients. It's also the right home for Razorpay webhooks, cron (slot cutoff, unpaid auto-cancel, daily stock rollover), PDFs and push notifications.

## Decisions log (from Q&A)
| Topic | Decision |
|---|---|
| Stack | React+Vite web, Express+TS API, **Prisma**, PostgreSQL, Expo app, pnpm + Turborepo monorepo |
| Apps | **1 Expo app** with role-based UI for customer, vendor and delivery. Other roles see "use web portal" |
| Web | **One Vite app**: customer shop at `/`, staff portal at `/dashboard/*`, super admin login at `/admin`. Bundles code-split per role |
| Vendor model | Vendors **supply to us** (purchase orders); customers buy from Sabjiilelo |
| Delivery | **Time slots**. Default slots are Morning 7–10 AM and Evening 5–8 PM, daily, editable per area, each with cutoff and capacity |
| Units | Each item has its own unit (kg/g/piece/bunch/dozen/litre/pack) and sellable variants |
| Area | City plus a pincode list. The address pincode decides the area |
| Stock | **Daily available qty** per item; shows "Sold out" at 0 |
| Auth | Phone + OTP. **OTP is fixed at `9999`** (no SMS provider yet). Super admin uses username + password at `/admin` (seeded) |
| Users | **One role + one area per user**. Many managers, accountants, vendors and riders per area; **one admin per area** |
| Catalog edits | Admin creates and edits items; Admin and Manager set daily price and stock |
| Payments | Razorpay (test mode) + COD, with **no COD rules** in MVP |
| Coupons/fees | Per-area coupons, minimum order, delivery fee, free-delivery threshold. **No wallet** |
| Cancel | Free cancel until slot cutoff, with full auto-refund for prepaid. After that, admin or manager only |
| Notifications | In-app timeline + **Expo push**. WhatsApp is out of the MVP (a Notifier interface is kept so it can be added) |
| Invoice | **Not GST-registered**: issue a "Bill of Supply". HSN and GST fields stay ready on items. Numbering: `{AREACODE}/{FY}/{seq}` |
| Refunds | Rider-verified **doorstep rejections auto-refund** up to a per-area limit (default ₹200); above that the accountant approves. **24h issue reports always go to the accountant** |
| Feedback | Star rating + comment after delivery; "Report issue" within 24h with a photo |
| Shortage at packing | **Minimal**: manager can reduce qty or remove the line, and the bill recalculates. Substitution flow is deferred |
| Manager | Order ops/packing, bill generation, **counter POS**, stock entry (GRN) |
| Accountant | COD reconciliation, vendor payouts, reports, refund approvals |
| Vendor | Receive and accept purchase orders, submit daily rates, track supply and payments |
| HR | Deferred to phase 2 (the role exists, with a placeholder screen) |
| Live tracking | No live map. Status updates only |
| Dispatch | Manager assigns riders manually (bulk by pincode) |
| Hosting | Render (API, static web, Postgres) + EAS builds (Android first) |
| Theme | `THEME.md` tokens and fonts. You'll copy the assets (logo, banners, 3D icons) into the repo |

## Repo layout
```
sabjiilelo/
├─ apps/
│  ├─ api/      Express: src/modules/<feature>/{router,controller,service,schema}.ts, src/middleware, src/jobs, prisma/
│  ├─ web/      Vite React: src/features/{shop,auth,superadmin,admin,manager,accountant,vendor,delivery}
│  └─ mobile/   Expo Router: app/(auth), app/(customer), app/(vendor), app/(delivery)
├─ packages/
│  ├─ shared/   enums, zod schemas, permissions.ts, order state machine, money/unit/pricing utils
│  ├─ api-client/ typed client + TanStack Query hooks (web + mobile)
│  ├─ theme/    tokens from THEME.md → tailwind preset (web) + NativeWind preset (app)
│  ├─ assets/   logo, banners, 3D icons (.webp) — copied in by you
│  └─ config/   tsconfig/eslint presets
├─ docs/PLAN.md, THEME.md, turbo.json, pnpm-workspace.yaml, .env.example
```

## Theme (from THEME.md)
- **Tokens**: `primary #0e5a32`, `dark-green #064420`, `light-green #d9f2e0`, `beige #f5ebd7`, `cream #fbf6ea` (app background), `accent #ff8a3d`.
- **Promoted to tokens**: `leaf #4caf3d`, `ink #0b1a10` (headings), `body #1c2a20`.
- **Fonts**: Poppins 400–700 for UI; Caveat 600/700 for accents like "Fresh from the farm". Loaded with `@fontsource` on web and `expo-font` on the app.
- **Shared**: one `packages/theme` preset feeds both Tailwind and NativeWind, so the web and app look identical.
- **Motion**: the subtle motion from the marketing site (pop on add-to-cart, leaf-float on empty states, truck on order tracking) is reused, and respects reduced motion.

## Auth and access control
- **Roles**: `SUPERADMIN, ADMIN, MANAGER, ACCOUNTANT, HR, DELIVERY, VENDOR, CUSTOMER`.
- **Super admin**:
  - Seeded from env (`SUPERADMIN_USERNAME/PASSWORD`, bcrypt) and logs in at `/admin`.
  - Can only manage **areas and admins** (create, edit, block), plus view all data read-only.
- **OTP login** (`POST /auth/otp/request`, `/auth/otp/verify`):
  - `OTP_MODE=fixed` accepts `9999`. An `OtpProvider` interface is ready for MSG91 later.
  - Rate-limited per phone and IP; 5 attempts max.
  - If the phone is unknown, a `CUSTOMER` is created.
  - If an admin pre-created the phone, login gives that role and area. Staff can't self-register.
  - If an admin adds an existing customer phone as staff, the user is converted to that role (one role per user).
  - Blocked users can't log in.
- **Tokens**:
  - Access JWT lasts 15 minutes. The refresh token lasts 30 days, is rotated, and is stored hashed in `sessions`. Logout and block revoke sessions.
  - Web keeps the refresh token in an httpOnly cookie; the app keeps it in SecureStore.
- **API guards**:
  - `authenticate` → `requireRole()` → `areaScope` (every query and write is forced to `req.user.areaId` except for SUPERADMIN).
  - An admin can only create MANAGER, ACCOUNTANT, HR, DELIVERY or VENDOR users in their own area.
  - Cross-area access returns **403**.
- **Client gates**: the app allows customer, vendor and delivery only. Web routes are guarded by role from `packages/shared/permissions.ts`.

## Data model (Prisma; money in **paise ints**, qty `Decimal(10,3)`)
- **Org**:
  - `Area` (code e.g. JBP, name, city, isActive, minOrder, deliveryFee, freeDeliveryAbove, autoRefundLimit, invoiceSeq)
  - `AreaPincode`
  - `User` (phone unique, name, role, areaId?, status, createdById, expoPushToken?)
  - `Session`, `OtpCode`, `SuperAdminCredential`
  - `AuditLog` (actor, action, entity, before/after)
- **Customer**: `Address` (label, line1, landmark, pincode → areaId, lat/lng?).
- **Catalog**:
  - `Category` (areaId, name, image, sort)
  - `Item` (areaId, categoryId, name, desc, images[], unitType, hsn?, gstRate=0, isActive)
  - `ItemVariant` (label "500 g", qty, unit, pricePaise, mrpPaise, isActive)
- **Stock**: `DailyStock` (areaId, itemId, date, availableQty, reservedQty, soldQty) and `StockMovement` (PURCHASE/SALE/WASTAGE/ADJUST/RELEASE, qty, refType/refId).
- **Slots**: `DeliverySlot` (areaId, label, start, end, cutoffMinutesBefore, capacity, daysOfWeek[]) and `SlotBooking` (slotId, date, used).
- **Commerce**:
  - `Cart`/`CartItem`
  - `Coupon` + `CouponRedemption`
  - `Order`: areaId, customerId, addressSnapshot, slotId, slotDate, channel APP/WEB/POS, status, subtotal, deliveryFee, discount, total, finalPayable, paymentMode, paymentStatus, riderId, invoiceNo, cancelReason
  - `OrderItem` (variantSnapshot, qty, price, packedQty, rejectedQty, rejectReason, rejectPhotoUrl)
  - `OrderEvent` (timeline + actor)
  - `Payment` (razorpayOrderId, paymentId, amount, status, raw webhook)
  - `Refund` (orderId, source DOORSTEP/ISSUE/CANCEL/SHORTAGE, amount, status, auto bool, approvedById, razorpayRefundId)
  - `Rating` (orderId, stars, comment)
  - `IssueReport` (orderId, itemId, type, photo, status, refundId?)
- **Supply**:
  - `Vendor` (userId, businessName, bank info)
  - `VendorRate` (vendorId, itemId, date, ratePaise, unit)
  - `PurchaseOrder` (areaId, vendorId, forDate, status SENT/ACCEPTED/ADJUSTED/REJECTED/RECEIVED/CLOSED) + `PoItem` (orderedQty, acceptedQty, receivedQty, rate)
  - `VendorLedger` (PAYABLE/PAYMENT, amount, refPo, note, by)
- **Cash**: `RiderCashDay` (riderId, date, codExpected, deposited, receivedById, status OPEN/SETTLED/SHORT).
- **Notifications**: `Notification` (userId, title, body, data, readAt). A `Notifier` sends via Expo push; the WhatsApp adapter is a stub.

## Order lifecycle
`PLACED → CONFIRMED → PACKING → PACKED → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED | PARTIALLY_DELIVERED` and `CANCELLED`. Prepaid orders start as `PAYMENT_PENDING`. Allowed transitions per role are defined in `packages/shared/orderMachine.ts`, used by the API and to show and hide buttons in the UI.

1. **Checkout**:
   1. The address pincode must map to an active area; otherwise show "Not serviceable yet".
   2. Only slots before their cutoff with remaining capacity are shown.
   3. Apply the coupon, then the minimum order, delivery fee and free-delivery threshold.
   4. **Place** runs in one DB transaction: lock and reserve `DailyStock`, book slot capacity, create the order.
2. **Razorpay**: the server creates the Razorpay order, then the client checkout runs, then the server verifies the signature. The `payment.captured` webhook is idempotent. A cron job cancels `PAYMENT_PENDING` orders after 15 minutes and releases stock.
3. **Cancel**: the customer can cancel before the slot cutoff. Stock and slot are released, and prepaid orders get an auto refund.
4. **Packing (manager)**:
   1. A slot-wise **pick list** shows totals per item.
   2. Per order, the manager can reduce qty or remove a line. The bill recalculates and prepaid orders get a shortage refund.
   3. Mark PACKED, then generate the Bill of Supply PDF and packing slip (pdfkit).
5. **Dispatch**: the manager filters PACKED orders by pincode and bulk-assigns them to an online rider.
6. **Rider**: sees assigned orders, then Start, then Out for delivery. At the door:
   1. Per item, mark **Rejected** (qty, reason, photo).
   2. Collect the recalculated COD amount, or prepaid orders get a doorstep refund.
   3. Mark Delivered or Partially delivered.
   4. Doorstep refunds at or below `autoRefundLimit` are processed instantly through the Razorpay refund API; above it they go to the accountant.
7. **After delivery**: the customer can rate the order, and has **24h** to report an issue with a photo, which goes to the accountant queue.
8. **POS**: the manager's counter screen. Search items, enter qty or weight, choose cash or UPI, optionally capture the customer's phone. This creates a `channel=POS` order, which is DELIVERED immediately, deducts stock and prints a receipt.
9. **Supply**:
   1. Vendors submit daily rates in the app.
   2. After the evening cutoff, the system shows **tomorrow's demand** per item (confirmed orders + buffer %).
   3. The manager creates POs per vendor, prefilled with the best rate.
   4. The vendor accepts, adjusts or rejects in the app.
   5. The manager records a GRN (received qty). This writes a `StockMovement`, adds to the `VendorLedger` payable, and optionally tops up `DailyStock`.
10. **Accounts**:
    - **COD**: per rider per day, expected vs deposited, then mark settled or short.
    - **Vendor payables**: mark payments (UTR, note).
    - **Refund queue**: approve or reject.
    - **Reports**: sales by day, item, slot and payment mode; refunds; vendor purchases. Export as CSV/XLSX.

## Screens by role
- **Super admin (`/admin`)**: areas (code, city, pincodes, fees, refund limit), admins (phone, name, area), block, read-only overview.
- **Admin (`/dashboard`)**:
  - Today's KPIs: orders per slot, revenue, sold-out items, pending refunds.
  - Staff CRUD, categories and items (variants, images), price board, stock board, slots, coupons, banners, area settings.
  - All orders (with cancel), ratings and issues.
- **Manager**: stock and price board, slot orders, pick list, packing, invoices, dispatch, POS, demand view, POs, GRN.
- **Accountant**: COD reconciliation, vendor payables, refund queue, issue reports, reports and export.
- **HR**: "Coming soon" placeholder.
- **Customer (app + web `/`)**:
  - Splash with the theme truck animation, phone OTP, set location (pincode check), home (banners, categories, "Today's fresh picks", reorder last).
  - Category list, search, item detail (variant chips + stepper), cart with fee and coupon breakdown, slot picker, checkout (Razorpay/COD).
  - Order tracking timeline, order detail (rejected items, refund status), rate order, report issue, addresses, profile, notifications.
- **Vendor (app)**: today's rates entry, PO inbox (accept/adjust/reject), supply history, ledger and payments.
- **Delivery (app)**: online/offline, today's assigned orders by slot, order detail (call, navigate via Google Maps intent), doorstep rejection with camera, COD summary for the day.

**UX principles**:
- One-thumb navigation and large produce photos on a cream background.
- Variant chips and an add stepper right on the product card.
- A sticky cart bar showing the total and the next slot ("Arrives tomorrow 7–10 AM").
- Skeleton loaders, haptics on add, and empty states with the leaf illustration.

## Milestones (about 10 weeks)
1. **W1 Foundation**: monorepo, theme package, Prisma schema, migrations and seed (super admin, Jabalpur and Satna areas, demo staff, 30 items), auth (OTP 9999, password), RBAC, area scope, error handling, CI (lint, typecheck, test).
2. **W2 Org + Catalog**: super admin and admin portal, staff CRUD, catalog with Cloudinary uploads.
3. **W3 Commerce config**: daily stock and price boards, slots, coupons, fee rules, banners.
4. **W4–5 Customer**: app and web shop through checkout, COD and Razorpay test mode, cancel, timeline, push notifications.
5. **W6 Ops**: pick list, packing and shortage, Bill of Supply PDF, dispatch.
6. **W7 Delivery**: rider app, doorstep rejection, refunds (auto and queue), rating, 24h issues.
7. **W8 Supply**: vendor app (rates, POs), demand view, GRN, vendor ledger.
8. **W9 Accounts + POS**: COD reconciliation, payables, refund queue, reports and export, POS.
9. **W10 Hardening**: audit log review, rate limits, Sentry, Render deploy, EAS Android internal build, UAT in one area.

## Deployment
- **API**: Render Web Service with `/health`, `prisma migrate deploy` on release, and node-cron jobs in-process (one instance in MVP).
- **Web**: Render Static Site with an SPA rewrite.
- **Database**: Render Postgres with daily backups.
- **Images**: Cloudinary free tier.
- **Env**: `DATABASE_URL, JWT_SECRET, REFRESH_SECRET, OTP_MODE=fixed, OTP_FIXED=9999, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET, CLOUDINARY_*, SUPERADMIN_USERNAME/PASSWORD, CORS_ORIGINS, EXPO_ACCESS_TOKEN`.
- **App**: EAS Build (Android first) with `EXPO_PUBLIC_API_URL`.

## Phase 2 backlog
HR (KYC, attendance, salary), substitution flow, wallet, subscriptions/daily basket, harvest and source tags, Hindi i18n, WhatsApp/SMS (MSG91, BSP), live rider map, auto-dispatch, combos and recipe kits, COD rules, GST registration and tax invoices, multi-role users, iOS release.

## Pending from you
- Copy the brand assets (logo-full, hero-banner, farmer-banner, 3D icons, app icon) into the repo, for example `/design`.
- Razorpay test keys and a Cloudinary account, by W4 and W2 respectively.

## Verification
- **Vitest unit tests**: pricing and fees, coupon rules, unit/variant math, stock reservation and release, order state machine, refund auto-limit, area scope guard.
- **Supertest API tests** per module, including cross-area 403 and role-forbidden checks.
- **End-to-end run on seed data**:
  1. Customer in Jabalpur orders COD and Razorpay test orders.
  2. Manager packs with a reduced qty and dispatches.
  3. Rider rejects one item at the door, and an auto-refund is triggered.
  4. Customer reports an issue, and the accountant approves it.
  5. Accountant settles the rider's COD.
  6. Vendor PO goes through to accept, GRN and payable, then gets paid.
  7. Satna admin sees no Jabalpur data.
- **Local run**: `pnpm dev` (API + web) plus Expo dev client against the local API. Check the web shop and app look identical using theme tokens.
