# Sabjii Le Lo

Fresh vegetables and fruits delivered in scheduled slots, with a freshness promise: customers can hand back anything that isn't fresh at the door.

The full product plan is in [docs/PLAN.md](docs/PLAN.md). Brand tokens and assets are in [THEME.md](THEME.md) and `public/`.

## What's in the repo

| Path | What it is |
|---|---|
| `apps/api` | Express + Prisma + PostgreSQL API used by both web and mobile |
| `apps/web` | React (Vite) web app: customer shop at `/`, staff portal at `/dashboard`, super admin at `/admin` |
| `apps/mobile` | Expo app for customers, delivery partners and vendors |
| `packages/shared` | Enums, zod schemas, permissions, order state machine, money/unit/date helpers |
| `packages/api-client` | Typed API client and query keys shared by web and mobile |
| `packages/theme` | Brand colours and fonts from THEME.md |
| `public/` | Logo, banners and 3D icons (served by the web app and at `/static` by the API) |

## Run it locally

Requires Node 22 and pnpm 10.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then set DATABASE_URL / DIRECT_URL
pnpm db:migrate                          # create tables
pnpm db:seed                             # demo areas, staff, 30 items, stock, coupons
pnpm dev                                 # API on :4000 and web on :5173
pnpm dev:mobile                          # Expo; open in Expo Go on the same Wi-Fi
```

The phone reaches the API through your computer's LAN address automatically in development. Set `EXPO_PUBLIC_API_URL` to point it elsewhere.

## Demo logins (after seeding)

Every OTP is **9999** while `OTP_MODE=fixed`.

| Who | How |
|---|---|
| Super admin | `/admin` · `superadmin` / `Sabjii@123` |
| Jabalpur admin | 7897897897 |
| Satna admin | 7797897897 |
| Manager (Jabalpur) | 9111111111 |
| Accountant (Jabalpur) | 9222222222 |
| HR (Jabalpur) | 9333333333 |
| Delivery partner (Jabalpur) | 9444444444 (web or app) |
| Vendor (Jabalpur) | 9555555555 (web or app) |
| Customer | 9876543210, or any new number |

Serviceable pincodes: Jabalpur 482001–482005, 482008, 482011; Satna 485001, 485002, 485005.

## Payments, OTP, images and push

- **Razorpay**: with no keys the API runs a mock gateway, and checkout shows a "test payment" step. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` to switch to real test or live payments. Point the Razorpay webhook at `/api/payments/webhook`.
- **OTP**: `OTP_MODE=fixed` accepts `OTP_FIXED` for everyone. The MSG91 adapter goes in `apps/api/src/services/otp.ts`.
- **Images**: stored under `apps/api/uploads` unless `CLOUDINARY_URL` is set. Set it in production, because Render's disk is wiped on every deploy.
- **Push**: works once the app has an EAS project id (`eas init`) and runs as a development or production build.

## Tests

```bash
pnpm --filter @sabjiilelo/shared test   # pricing, units, dates, order rules
pnpm --filter @sabjiilelo/api test      # full business flow against the database
```

The API test creates a throwaway area, runs the whole order, delivery, refund, vendor and accounts flow, then deletes everything it created.

## Deploy

- **API and web**: `render.yaml` is a Render blueprint for both. The web static site proxies `/api` to the API so the login cookie stays first-party.
- **Mobile**: `apps/mobile/eas.json` has `preview` (Android APK) and `production` profiles. Run `eas build -p android --profile preview`.
