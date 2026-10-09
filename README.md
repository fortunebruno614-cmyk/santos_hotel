# Santo Hotel

Single-tenant hotel booking web application: public guest side (search → view → book → pay → confirmation) and a protected staff/admin side (rooms, availability, reservations, guests, payments, reports).

## Stack

- Next.js 16 (App Router, TypeScript) — React 19
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- Tailwind CSS 4
- ESLint

## Quick start

```bash
npm install
cp .env.example .env     # adjust DATABASE_URL for your Postgres
createdb santos_hotel
npm run db:migrate
npm run db:seed
npm run db:smoke         # → "Database connection OK. Hotel rows: 1"
npm run dev              # http://localhost:3000
```

Full instructions (Docker DB, Prisma 7 notes, scripts): [docs/setup.md](docs/setup.md).

## Tests

```bash
npm test               # node:test — runs serially (tests share the dev DB)
```

Needs the dev database migrated + seeded (`npm run db:migrate && npm run db:seed`).
DB-backed tests use their own date windows and booking-reference prefixes, and clean
up after themselves.

## Documentation

- [Development pipeline & phases](docs/DEVELOPMENT_PLAN.md) — the build plan (P0–P9) and current phase
- [Open questions](docs/OPEN_QUESTIONS.md) — hotel business decisions pending confirmation
- [Entity relationship diagram](docs/ERD.md)
- [Data dictionary](docs/DATA_DICTIONARY.md)
- [Setup guide](docs/setup.md)
- [DB & storage sync](docs/DB_AND_STORAGE.md) — keeping database and media updated on GitHub
- Training guides (PDFs) in `docs/`

## Current status

- **P0 Environment Setup** — done: Next.js + Postgres + Prisma wiring, DB smoke test.
- **P2 Database & Domain Model** — done: 14 entities, enums, constraints (13 CHECKs),
  justified indexes, 10 versioned migrations, idempotent seed, and 15 integrity checks
  (`npm run db:integrity`). ERD + data dictionary in `docs/`.
- **P3 Authentication & Authorization** — done: session auth (JWTS via `jose`) for
  staff/admin and guest accounts, three roles enforced by a central access map in
  `src/config/access-map.ts` (proxy pre-filter + `guardApi`/`require*` in server code),
  DB-backed session revocation, login throttling, and an audit log for login,
  failed login, permission change, access denied and logout.
  Gate: `npm run authz:check` → 54/54 checks (seed guests first with
  `npm run authz:fixtures`).
- **P4 Availability Engine** — done: availability service (`findAvailability`,
  `assertRoomsAvailable`, `createPendingBooking`), public `GET /api/public/availability`,
  half-open overlap rule proven equivalent to the night expansion, pending-hold window,
  cancellation trigger, and a `room_nights (room_id, night)` primary key that makes
  double-booking impossible at the database level.
  Gate: `npm test` → 35/35, including six parallel allocations of the last room →
  exactly one success.
- **P5 Booking & Checkout** — done: guest search/room detail/quote/checkout flow with
  in-transaction availability re-check and price re-validation, `SH-YYYY-NNNNNN`
  references, config-driven cancellation policy and server-side transition guards,
  staff walk-in/modify/check-in/out/notes/room-status console, guest booking history
  with eligible cancellation, and anonymous checkout via signed claim cookie.
  Gate: `npm test` → 60/60 (35 availability + 25 booking).
- **P6 Payments** — done: provider-agnostic payment layer with a fully working mock
  gateway (HMAC-signed webhooks, success/failure/partial-refund, hosted pay page),
  idempotent initiate and replay-safe webhook handling, desk capture, refund on
  cancellation (`REFUND_ON_CANCELLATION`, default on) and manual staff refunds. The
  real gateway is one registry entry + one env var (`PAYMENT_PROVIDER`) when #4 is
  answered. Gate: `npm test` → 75/75 (35 availability + 25 booking + 15 payments).
- Next up: **P7 Staff/Admin Console** (dashboard, CRUD, reports — see
  `docs/DEVELOPMENT_PLAN.md`).

## Migration workflow

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name <migration_name>`.
3. Commit the schema and the generated `prisma/migrations/**` together.

Never change the database by hand — every change is a committed migration.
