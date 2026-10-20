# Khaas — Full-Stack E-commerce Store

Built from the `ecommerce_blueprint_pack` (architecture, design, login, ui-pages, payments-orders).
Modular monolith: **Express API + Vite/React storefront**, brown & white premium editorial design.

## Quick start (demo)

```bash
cd server && npm install && npm run seed && npm start     # API on http://localhost:4000
# storefront is served by the same server (client/dist is prebuilt)
```

Or run the client separately during development:

```bash
cd client && npm install && npm run dev   # http://localhost:5173 (proxies /api → :4000)
```

Open **http://localhost:4000**.

## Demo logins (Firebase Auth)

Login at `/login` with **Google**, **Facebook**, **Phone OTP** (real SMS via Firebase),
or **Email link** (passwordless). No OTP is ever shown on screen.

| Role       | Login with (email must match) |
|------------|-------------------------------|
| Superadmin | `owner@khaas.in`              |
| Admin      | `catalog@khaas.in`            |

Staff roles come from the server database — sign in with the registered email/phone
and the existing role is kept. Public signups always become customers.

### Firebase setup (one-time, ~10 min)

**Firebase Console** (https://console.firebase.google.com):
1. Create/select project → **Build → Authentication → Sign-in method** → enable:
   **Google**, **Facebook**, **Phone**, **Email link (passwordless)**.
2. Facebook: first create an App at https://developers.facebook.com → add **Facebook Login**
   product → copy App ID + App secret into Firebase's Facebook provider config.
   Add `https://<your-project>.firebaseapp.com/__/auth/handler` as a Valid OAuth Redirect URI in the Facebook app.
3. **Authentication → Settings → Authorized domains**: add your domain (and `localhost` is allowed by default for testing).
4. **Project settings → Your apps → Web app** → copy config into `client/.env` (see `client/.env.example`).
5. **Project settings → Service accounts → Generate new private key** → put the JSON in
   `FIREBASE_SERVICE_ACCOUNT` (or `FIREBASE_SERVICE_ACCOUNT_PATH`) — see `server/.env.example`.
   The backend verifies every Firebase ID token with the Admin SDK before creating a session.

## What's implemented (per blueprint)

- **Storefront:** home, search, category, product detail, cart, checkout, QR-payment
  submission, account (profile / orders / addresses / wishlist), OTP login, info pages.
- **Auth:** 6-digit OTP (hashed, 5-min expiry, 5 attempts, resend cooldown, hourly caps),
  HttpOnly session cookies, server-side role checks on every protected route.
- **Catalog:** categories, variants (SKU), integer-paise pricing, stock, coupons.
- **Checkout:** server recalculates all totals, validates stock, decrements atomically,
  snapshots order lines, idempotency keys — client totals are never trusted.
- **Payments:** QR/manual UPI claim workflow — submission is a *claim for review*,
  never auto-approved; Superadmin approve/reject with mandatory reason, audit trail,
  duplicate-UTR detection, private screenshot storage with expiring signed URLs.
  COD supported as a separate flow.
- **Admin portal** (`/admin`): product management only — cannot touch payments/roles/settings
  (enforced by API middleware, 403 otherwise).
- **Superadmin portal** (`/superadmin`): overview, orders + fulfilment, payment review queue,
  categories, users, staff invite/revoke, coupons, reports, settings, audit log.
- **Design system:** espresso/walnut/caramel/sand/ivory tokens, Cormorant Garamond display
  accents + DM Sans UI, responsive down to 360px, reduced-motion respected.

## Data & money

- Demo store: JSON file DB at `server/data/db.json` (auto-created). Money is always
  integer **paise** — never floats.
- Uploads: `server/uploads/` (private; served via 15-min signed URLs).

## Production checklist (before real customers)

1. Firebase keys in place (`client/.env` — already wired for project `khaas-store` in v3 ZIP); `COOKIE_SECURE=true` over HTTPS. Backend verifies Firebase ID tokens against Google's public certs — no service-account secret needed on the server.
2. Swap `server/src/db.js` for Postgres + Prisma (schema mirrors the blueprint §5).
3. Put real product photography in `client/public/img/` (current SVGs are placeholders).
4. Configure your actual UPI ID in Superadmin → Settings; reconcile UTRs against
   bank statements — screenshots alone are not proof of settlement.
5. Add a proper payment gateway with signed webhooks if you outgrow manual review.
6. TLS, backups, rate-limit tuning, error monitoring.

## Project layout

```
store/
  server/          Express API (src/routes/*, src/auth.js, src/db.js, src/seed.js)
  client/          Vite + React (src/pages, src/pages/portals, src/components)
  scripts/         placeholder artwork generator
  ../blueprint/    the original blueprint pack (reference only)
```
