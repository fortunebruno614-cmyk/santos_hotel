# Santo Hotel — Development Pipeline & Phases

Derived from the Phase 1 (Product Understanding) and Phase 2 (Database & Domain Model) training guides.
This plan turns those guides into an executable build pipeline so implementation can start.

**Stack (decided):** Next.js (App Router, TypeScript) + PostgreSQL + Prisma.
**Repo:** single-tenant hotel booking web app — public guest side + protected staff/admin side.

---

## Ground Rules (apply to every phase)

1. Backend is the final authority for availability, price, discount, cancellation, payment and permission rules.
2. Design the data model before writing business logic (Phase 2 principle).
3. All schema changes go through version-controlled Prisma migrations — no manual DB edits.
4. Current configuration (rates, room status) and historical transaction data (booking prices) stay separate.
5. Every phase ends with a **gate**: mentor/repo review of deliverables before the next phase starts.
6. Unresolved hotel policy questions (currency, check-in/out times, cancellation window, payment provider) stay in `docs/OPEN_QUESTIONS.md` — never invented in code.

---

## Pipeline Overview

```
P0 Environment Setup
 → P1 Product Understanding (training gate)
 → P2 Database & Domain Model
 → P3 Authentication & Authorization
 → P4 Availability Engine
 → P5 Booking & Checkout
 → P6 Payments
 → P7 Staff/Admin Console
 → P8 Notifications, Audit & Reports
 → P9 Testing, Hardening & Deployment
```

Each phase = branch → work → PR → gate review → merge to `main`.

**Branch naming:** `p2/schema-core`, `p4/availability-overlap`, `p5/checkout-flow`
**PR rule:** one phase-sized PR per gate, or smaller stacked PRs for tasks over ~400 lines.

---

## P0 — Environment Setup (0.5 day)

**Goal:** A reproducible local environment a clean clone can boot from.

Tasks:
- [ ] `npx create-next-app` (TypeScript, App Router, Tailwind, ESLint) as project root
- [ ] Add Prisma + PostgreSQL (local via Docker `docker-compose.yml`, or a hosted dev DB)
- [ ] Define `.env.example` (`DATABASE_URL`, `NEXTAUTH_SECRET`, payment provider keys) — never commit `.env`
- [ ] Directory layout:
  ```
  prisma/          schema.prisma, migrations/, seed.ts
  src/app/         public site + /admin
  src/server/      services, availability, pricing, auth
  src/lib/         prisma client, validators
  tests/           unit + integration
  docs/            OPEN_QUESTIONS.md, ERD, DATA_DICTIONARY.md
  ```
- [ ] Git: protect `main`, require PR, add `README.md` with boot steps

**Gate:** `git clone` → `docker compose up` → `npx prisma migrate dev` → `npm run dev` works on a clean machine.

---

## P1 — Product Understanding (1–3 days, from guide)

**Goal:** Explain the system without reading the code.

Tasks:
- [ ] Read PRD + both training guides
- [ ] Deliverables: product summary, user map, guest flow, staff flow, entity list, ≥15 business rules, ≥10 edge cases, public/private map, open questions
- [ ] Internalize: room type vs physical room; room status vs booking status vs payment status; date-range overlap & back-to-back bookings; availability re-checked at finalization

**Gate:** Can draw guest + staff journeys, state the three status groups, and identify which rules are backend-enforced.

---

## P2 — Database & Domain Model (3–5 days, from guide)

**Goal:** A schema that supports availability, bookings, payments and reporting without redesign.

### P2.1 Domain → ERD
- [ ] Confirm entity list: Hotel, User, Guest, RoomType, Room, Amenity, RoomImage, Rate, Booking, BookingRoom, Payment, Promotion, Notification, AuditLog (+ `room_type_amenities` junction)
- [ ] Draw ERD with cardinality (hotel 1—* room types; room type 1—* rooms; guest 1—* bookings; booking 1—* booking rooms; booking 1—* payments; room types *—* amenities)
- [ ] Data dictionary: field, meaning, type, required/optional → `docs/DATA_DICTIONARY.md`

### P2.2 Schema (Prisma) + migration order
Create `prisma/schema.prisma` in FK-dependency order:

```
001 hotels        005 rooms          009 booking_rooms
002 users         006 amenities      010 payments
003 guests        007 rates          011 promotions
004 room_types    008 bookings       012 notifications
                  013 room_type_amenities
                  014 audit_logs
```

- [ ] Primary keys (BIGINT/UUID — pick one, stay consistent); separate customer-facing `booking_reference` (e.g. `SH-2026-000123`) from PK
- [ ] FKs with explicit deletion behavior (`Restrict` for guests/bookings/payments, `Cascade` only where safe)
- [ ] Constraints: `NOT NULL` on required fields, `UNIQUE` on `rooms.room_number`, `bookings.booking_reference`, `promotions.code`, `users.email`, `payments.provider_reference`
- [ ] Money as `DECIMAL(10,2)` (or `Decimal` in Prisma) — never float
- [ ] Controlled status enums:
  - `RoomStatus`: Available, Reserved, Occupied, Cleaning, Maintenance, OutOfService
  - `BookingStatus`: Pending, Confirmed, CheckedIn, CheckedOut, Cancelled, NoShow
  - `PaymentStatus`: Pending, Paid, Failed, Refunded, PartiallyRefunded
- [ ] Historical snapshots: `booking_rooms.nightly_rate` / `room_total`, `bookings.subtotal/taxes/fees/discount/total`, `promotions` applied value — all frozen at booking time
- [ ] Normalize: amenities live in `room_type_amenities`, not comma-separated text

### P2.3 Indexes (justify each with its query)
- [ ] `bookings.booking_reference` (lookup), `bookings.guest_id`, `bookings.check_in`, `bookings.check_out`, `bookings.booking_status`
- [ ] `rooms.room_type_id`, `rooms.status`
- [ ] `booking_rooms.booking_id`, `booking_rooms.room_id`
- [ ] `payments.booking_id`, `payments.provider_reference`
- [ ] Composite on `booking_rooms (room_id, )` + bookings dates for the overlap query — validate with `EXPLAIN` during P4

### P2.4 Seed + integrity tests
- [ ] `prisma/seed.ts`: Santo Hotel, 3 room types (Deluxe King, Executive Suite, Family Room), ~10+ rooms (101–103, 201–202…), amenities (Wi-Fi, AC, TV, Mini Fridge, Private Bathroom), realistic rates — fake data only
- [ ] Integrity tests: duplicate room number rejected; orphan FK rejected; seed is idempotent; migrations run from a clean database

**Gate:** ERD + data dictionary reviewed, `prisma migrate reset` on an empty DB succeeds, integrity tests pass, no critical open business assumptions.

---

## P3 — Authentication & Authorization (2–4 days)

**Goal:** Public vs protected areas enforced on the backend.

- [ ] Auth (Auth.js/NextAuth or equivalent) for staff/admin; optional guest accounts (per open question: can guests book without an account?)
- [ ] Roles: `Admin`, `Staff`, `Guest` — enforced in server code/middleware, not only hidden in UI
- [ ] Access map: public = home, room list/detail, availability search, booking initiation; guest = profile, booking history; staff/admin = dashboard, reservations, rooms, rates, guests, payments, reports, users
- [ ] Audit log writer hooked into auth (login, permission change)

**Gate:** A `Staff` user cannot hit admin API routes; a `Guest` cannot read another guest's bookings.

---

## P4 — Availability Engine (3–5 days)

**Goal:** Correct overlap detection — the core of the product.

- [ ] Service: given `(check_in, check_out, adults, children)` → eligible room types and physical rooms
- [ ] Exclusions: room not active, Maintenance/OutOfService, allocated to an overlapping booking
- [ ] Overlap rule: `existing.check_in < requested.check_out AND existing.check_out > requested.check_in` (half-open intervals — confirm same-day turnover with hotel policy)
- [ ] Consideration: hold/reservation window for unpaid Pending bookings so they don't leak inventory forever
- [ ] Unit tests for every Phase 1 edge case: overlapping, back-to-back, no rooms, room in maintenance, concurrent booking of the last room

**Gate:** Double-booking is impossible under concurrent requests (DB constraint/transaction + test proving it).

---

## P5 — Booking & Checkout (4–6 days)

**Goal:** Guest search → book → confirm, and staff manual booking.

- [ ] Public: search form, room list, room detail, price calculation (server-side: rate × nights + taxes/fees − discount)
- [ ] Checkout: guest details → price re-validation → **availability re-checked inside the booking transaction** → create `Booking` + `BookingRoom` + snapshot prices → status `Pending`
- [ ] Booking reference generator (`SH-YYYY-NNNNNN`), unique constraint
- [ ] Cancellation policy evaluation (window from config, not hardcoded), status transitions guarded server-side
- [ ] Staff: manual booking (phone/walk-in), modify, check-in, check-out, operational notes, room status transitions (CheckedOut → Cleaning → Available)
- [ ] Guest area: booking history, upcoming reservations, eligible cancellation

**Gate:** End-to-end guest booking and staff walk-in booking both produce correct, priced, referenced reservations; no booking can bypass availability re-check.

---

## P6 — Payments (3–5 days, provider TBD)

**Goal:** Payment verified before a booking counts as paid.

- [ ] Provider integration (open question — confirm gateway) + webhook endpoint with signature verification
- [ ] `Payment` records: provider, provider_reference, amount, currency, status, paid_at, refunded_at — no raw card data
- [ ] Idempotency: payment page refresh must not double-charge; webhook replays must not double-record
- [ ] Failure paths: payment fails → booking stays `Pending`/unpaid, never `Confirmed` as paid; payment succeeds but booking creation failed → reconcile via webhook
- [ ] Refund on staff cancellation → `Refunded`/`PartiallyRefunded` with status sync back to booking

**Gate:** Failure, retry, replay and refund scenarios all covered by tests.

---

## P7 — Staff/Admin Console (4–6 days)

**Goal:** The hotel can run operations without direct DB access.

- [ ] Dashboard: today's arrivals/departures, occupancy, availability board
- [ ] CRUD: room types, physical rooms, amenities, rates, promotions
- [ ] Reservation management: search, filter, modify, cancel, check-in/out, notes
- [ ] Guest records, payment records, refund actions (permission-gated)
- [ ] Admin: user/permission management, system settings (check-in/out times, tax, currency, cancellation window), website content
- [ ] Every mutating admin action writes an `AuditLog` (action, entity, old/new values)

**Gate:** Admin can run a full week of simulated operations from the UI only.

---

## P8 — Notifications, Audit & Reports (2–4 days)

- [ ] Notifications: booking confirmation, cancellation, payment success/failure (channel per open question — email first)
- [ ] Audit log coverage review across all admin/staff mutations
- [ ] Reports: occupancy, revenue by period, booking status breakdown, cancellations/no-shows
- [ ] Pagination, date-range filters, and export where useful

**Gate:** A confirmed booking triggers confirmation; reports reconcile with seed + test bookings.

---

## P9 — Testing, Hardening & Deployment (3–5 days)

- [ ] Unit tests: pricing, discount, cancellation window, overlap logic
- [ ] Integration tests: booking transaction, payment webhook, permission checks
- [ ] E2E happy path + top 10 Phase 1 edge cases
- [ ] Security: input validation (Zod) on every route, auth on every protected route, secrets never logged, rate limiting on search/checkout/payment
- [ ] Performance: `EXPLAIN` the availability query, confirm indexes are used
- [ ] CI: install → lint → typecheck → test → `prisma migrate deploy` on a shadow DB
- [ ] Deploy (Vercel/hosted Postgres or Docker), staging smoke test, backup/restore check
- [ ] Resolve or formally defer every item in `docs/OPEN_QUESTIONS.md`

**Gate:** CI green on `main`, staging booking flow works end-to-end, rollback path documented.

---

## Definition of Done (per task)

- Backend enforces the rule (not just the UI)
- Migrations run clean from an empty database
- Tests for the happy path and at least one failure case
- Lint + typecheck pass
- Open questions updated if a hotel policy had to be assumed

## Standing Open Questions (from Phase 1 §20 — block P5/P6 until answered)

Currency · check-in/check-out times · cancellation policy · no-show policy · taxes/fees in display price · payment gateway · guest booking without account · children occupancy counting · multi-room bookings · required ID info · payment-succeeded-booking-failed handling · who can cancel/modify · who can change prices · notification channels · special pricing dates.

Track these in `docs/OPEN_QUESTIONS.md`; the first ones are prerequisites for pricing (P5) and payments (P6).
