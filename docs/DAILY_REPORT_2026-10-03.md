# Daily Task Report — Santo Hotel

**Date:** Saturday, 3 October 2026
**Scope:** Project bootstrap → Phase 2 (Database & Domain Model)
**Stack:** Next.js 16 (App Router, TS) · PostgreSQL 16 · Prisma 7.10.0 (`@prisma/adapter-pg`) · Tailwind 4

---

## 1. Summary

| # | Task | Status |
| - | ---- | ------ |
| 1 | Development pipeline & phase plan (P0–P9) | Done |
| 2 | P0 — local environment setup (Next.js, Postgres, Prisma) | Done |
| 3 | Team onboarding + DB/storage GitHub workflow docs | Done |
| 4 | Shared repo push incl. Prisma + `.env` baseline | Done (commit `538b18e`) |
| 5 | Remove default Next.js welcome screen; Santo Hotel app shell | Done |
| 6 | P2 — full database & domain model | Done |
| 7 | P2 verification — clean-DB rebuild + integrity checks | Done (11/11) |

---

## 2. Development Pipeline (Phase Plan)

Created `docs/DEVELOPMENT_PLAN.md`: 10-phase pipeline with tasks, branch/PR
conventions and gates.

```
P0 Setup → P1 Product Understanding → P2 Database & Domain Model
→ P3 Auth & Authorization → P4 Availability Engine → P5 Booking & Checkout
→ P6 Payments → P7 Staff/Admin Console → P8 Notifications/Audit/Reports
→ P9 Testing, Hardening & Deployment
```

Also created `docs/OPEN_QUESTIONS.md` — 19 hotel policy questions that block
pricing/payments/notifications (currency, taxes, cancellation, gateway, etc.).

---

## 3. Environment Setup (P0)

- Scaffolded **Next.js 16.3.8** (TypeScript, App Router, Tailwind 4, ESLint, `src/`)
- **Prisma pinned to 7.10.0** — npm `latest` is an 8.0 RC with an incompatible CLI
- Local DB: Homebrew `postgresql@14`, database `santos_hotel`
- Runtime wired via `@prisma/adapter-pg` + singleton `src/lib/prisma.ts`
- `docker-compose.yml` (postgres:16-alpine) for teammates; committed `.env`
  baseline uses Docker creds, per-machine overrides in git-ignored `.env.local`
- Scripts: `db:migrate`, `db:deploy`, `db:reset`, `db:seed`, `db:studio`,
  `db:smoke`, `db:dump`, `db:restore`, `db:integrity`, `typecheck`, `postinstall`
- Removed leftover empty tables from the dev DB (with owner consent)

**Credentials**

| What | Value |
| ---- | ----- |
| Shared dev DB (Docker) | `santos` / `santos` / `santos_hotel` @ `127.0.0.1:5432` |
| Author machine (Homebrew) | `mac`, no password / `santos_hotel` @ `127.0.0.1:5432` |
| App user login | not implemented — arrives with P3 |

---

## 4. Team Workflow Docs & Push

- `docs/setup.md` — teammate onboarding (Docker option A, Homebrew option B,
  credentials, env rules, troubleshooting, Prisma 7 notes)
- `docs/DB_AND_STORAGE.md` — how the team keeps DB + storage updated on GitHub:
  migrations for schema, `npm run db:dump` / `db:restore` snapshots,
  `media/` + Git LFS for room images, push checklist
- `dumps/santos_hotel.dump` snapshot workflow added; `media/` tracked
- Committed and pushed to `main` (`538b18e`) including tracked `.env` baseline
  (dev-only credentials; real secrets must stay out of it)

---

## 5. App Shell — Default Next.js Screen Removed

- `src/app/page.tsx` re-built: Santo Hotel landing ("Your stay starts here",
  Browse & book / Your account / Hotel operations cards)
- `src/app/layout.tsx`: metadata title `Santo Hotel`, template `%s | Santo Hotel`
- Deleted template assets (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`,
  `window.svg`)

---

## 6. Phase 2 — Database & Domain Model

### Entities (14) + 8 enums

`hotels`, `users`, `guests`, `room_types`, `rooms`, `amenities`,
`room_type_amenities`, `room_images`, `rates`, `promotions`, `bookings`,
`booking_rooms`, `payments`, `notifications`, `audit_logs`

Enums: `UserRole`, `RecordStatus`, `RoomStatus`, `BookingStatus`,
`PaymentStatus`, `PromotionType`, `NotificationChannel`, `NotificationStatus`.

### Key design decisions

- UUID PKs, `snake_case` tables/columns, `DECIMAL(10,2)` money, `TIMESTAMPTZ`
- Room type vs physical room modeled separately (1—*)
- Many-to-many room types ↔ amenities via junction table (no comma-separated text)
- Historical snapshots: `booking_rooms.nightly_rate` / `room_total`, booking
  subtotal/taxes/fees/discount/total, `bookings.promotion_code`
- Customer booking reference (`SH-2026-000123`) kept separate from DB PK
- Payments store provider references only — no card data
- Deletion rules: RESTRICT for guests/rooms/payments; CASCADE for booking rooms;
  SET NULL for user references

### Migrations (all version-controlled)

| Migration | Contents |
| --------- | -------- |
| `..._init_hotels` | initial Hotel table (superseded by rename) |
| `..._users_guests` | `hotels` snake_case, users, guests |
| `..._rooms_amenities` | room_types, rooms, amenities, junction, room_images |
| `..._rates_promotions` | rates, promotions |
| `..._bookings_booking_rooms` | bookings, booking_rooms |
| `..._payments_notifications_audit` | payments, notifications, audit_logs |
| `..._add_check_constraints` | 13 raw-SQL CHECK constraints |

### Constraints & indexes

- 13 CHECK constraints: `check_out > check_in`, adults ≥ 1, children ≥ 0,
  non-negative amounts, `refunded_amount ≤ amount`, rate/promotion date order,
  capacity, max_uses
- Unique: room number, booking reference, user/guest emails where required,
  promotion code, `(booking_id, room_id)` composite
- Indexes justified for availability + lookup: `bookings(guest_id, check_in,
  check_out, booking_status)`, `rooms(room_type_id, status)`,
  `booking_rooms(room_id)`, `payments(booking_id)`, etc.

### Seed data (`prisma/seed.ts`, idempotent)

Santo Hotel · 3 room types (Deluxe King, Executive Suite, Family Room) · 9 rooms
(101–104, 201–202, 301–303) · 5 amenities · 3 rates · promotion `STAY10`.

### Documentation

- `docs/ERD.md` — Mermaid ER diagram with cardinality + design rationale
- `docs/DATA_DICTIONARY.md` — per-table columns, types, constraints, pending
  business values mapped to `OPEN_QUESTIONS.md`

---

## 7. Verification Evidence

| Check | Result |
| ----- | ------ |
| `npm run lint` | Pass |
| `npm run typecheck` (`next typegen && tsc`) | Pass |
| `npm run build` | Pass |
| `npm run dev` | Boots, `/` renders "Santo Hotel — Your stay starts here" |
| Clean DB rebuild (`migrate deploy` on empty DB + seed) | Pass — 9 rooms, 3 room types |
| `npm run db:integrity` | **11/11 passed** (uniques, FKs, restrict delete, checks, snapshots) |
| `npm run db:smoke` | Pass |
| `npm run db:dump` | Refreshed `dumps/santos_hotel.dump` with seed data |

---

## 8. Git State

- Pushed: `538b18e` — bootstrap, `.env` baseline, setup + DB/storage docs
- Pending (uncommitted) work from this session: P2 schema/migrations/seed,
  integrity script, ERD + data dictionary, app shell, README/status updates,
  refreshed DB dump

## 9. Open Items / Next Steps

1. Commit + push the pending P2 work to `main`
2. **P3 — Authentication & Authorization** (roles: Admin, Staff, Guest; public vs
   protected routes) — partially blocked by `OPEN_QUESTIONS.md` #13, #17
3. Confirm hotel policies needed before P5/P6 (currency, taxes, cancellation,
   payment gateway, check-in/out times)
4. P4 will add the DB-level availability exclusion constraint once same-day
   turnover policy (#7, #8) is confirmed
