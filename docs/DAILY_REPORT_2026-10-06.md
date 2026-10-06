# Daily Task Report — Santo Hotel

**Date:** Tuesday, 6 October 2026
**Scope:** Phase 4 — Availability Engine (correct overlap detection, the core of the product)
**Stack:** Next.js 16.3.8 (App Router, TS) · PostgreSQL (PGlite wire-protocol stand-in) · Prisma 7.10.0 · Zod · `node:test`

---

## 1. Summary

| # | Task | Status |
| - | ---- | ------ |
| 1 | `room_nights` ledger table + migration (DDL, backfill, cancel trigger) | Done — `20261006090000_p4_room_nights`, applied |
| 2 | Pure overlap/date module (half-open + closed modes) | Done — `src/server/availability/overlap.ts` |
| 3 | Availability service: search, in-transaction re-check, pending-hold sweep, allocation | Done — `src/server/availability/service.ts` |
| 4 | Input validation (zod) + config flags for the open questions | Done — `validation.ts`, `src/config/availability.ts` |
| 5 | Public search endpoint | Done — `GET /api/public/availability` |
| 6 | Unit + integration tests (edge cases, eligibility, holds, trigger) | Done — 22 DB-backed + overlap/validation suites |
| 7 | **Gate:** concurrency proof (double-booking impossible) | Done — 6 parallel allocations → exactly 1 winner; raw duplicate insert → `P2002` |
| 8 | Integrity checks extended for `room_nights` | Done — `npm run db:integrity` → **15/15** |
| 9 | Docs (plan, ERD, data dictionary, open questions, README, `.env.example`) | Done |
| 10 | Verification: `npm test` 35/35, `lint` 0, `typecheck` 0 | Done |

---

## 2. Architecture — three layers, strongest last

```
findAvailability (public search, read-only)
  active room types that fit the party
  − rooms in Maintenance / OutOfService
  − rooms held by a blocking booking that overlaps the window
        │
assertRoomsAvailable (same rules, re-run INSIDE the booking transaction
                      after SELECT … FOR UPDATE on the room rows)
        │
room_nights  PRIMARY KEY (room_id, night)   ← the database itself
  the booking transaction inserts one row per held night;
  a second allocation of the same night fails with P2002,
  no matter which code path attempted it.
```

**Blocking rule** (one source for search *and* re-check, `service.ts`):

```
booking_status <> 'CANCELLED'
AND ( booking_status <> 'PENDING'
      OR payment_status = 'PAID'                       -- committed money
      OR created_at >= now() - PENDING_HOLD_MINUTES )  -- unpaid hold window
```

**Overlap rule** (`overlap.ts`): `existing.check_in < requested.check_out AND
existing.check_out > requested.check_in` — half-open intervals (same-day turnover
allowed, `ALLOW_SAME_DAY_TURNOVER=true` default). Proven equivalent to intersecting
the `expandNights()` sets in both modes, so the SQL predicate and the `room_nights`
constraint can never disagree.

**Cancellation** fires trigger `bookings_release_room_nights` → the booking's night
rows are deleted in the database; **expiry** (`PENDING_HOLD_MINUTES=60`, unpaid, never
`PAID`) is swept by `releaseExpiredHolds()` at the start of the next allocation
transaction.

---

## 3. Design decision: `room_nights` instead of a gist exclusion constraint

The plan (and `docs/ERD.md`) promised `EXCLUDE USING gist (room WITH = AND
daterange(...) && ...)` — which needs the `btree_gist` extension. **PGlite cannot load
extensions** (`Could not open extension control file`), and this machine has no
Docker/system Postgres and no network installs.

The replacement keeps the guarantee instead of the syntax: a ledger table
`room_nights (room_id, night)` with `PRIMARY KEY (room_id, night)` — one row per room
per calendar night. `createPendingBooking` still locks rooms in sorted order and
re-runs the policy check under the lock; the PK is the backstop that makes the
guarantee unconditional. Deviation recorded in `docs/ERD.md`; on real Postgres the
exclusion constraint could be added later as belt-and-braces (same predicate).

---

## 4. What was built

| Path | Purpose |
| ---- | ------- |
| `prisma/migrations/20261006090000_p4_room_nights/` | `room_nights` table, index, FKs, backfill, cancel trigger + function |
| `src/config/availability.ts` | `ALLOW_SAME_DAY_TURNOVER`, `PENDING_HOLD_MINUTES`, `CHILDREN_COUNT_AS_ADULTS` |
| `src/server/availability/overlap.ts` | pure date arithmetic + the overlap rule (no I/O) |
| `src/server/availability/validation.ts` | `StaySearchSchema`, `MAX_STAY_NIGHTS = 60` |
| `src/server/availability/service.ts` | `findAvailability`, `assertRoomsAvailable`, `releaseExpiredHolds`, `createPendingBooking`, `StayValidationError`, `AvailabilityConflictError` |
| `src/app/api/public/availability/route.ts` | `GET` search endpoint (already public in the P3 access map) |
| `tests/helpers.ts` | shared fixtures: test guest, prefix-scoped cleanup, seed inventory |
| `tests/availability/*.test.ts` | 35 tests: overlap math, zod edge cases, DB behavior, concurrency gate |
| `scripts/db-integrity.ts` | +4 checks (night insert, PK duplicate, FK, cancel release) |

`createPendingBooking` is the transactional primitive P5 checkout will wrap: it takes a
unique `bookingReference` (P5 owns the `SH-YYYY-NNNNNN` generator) and allocates
`bookings` + `booking_rooms` + `room_nights` atomically.

---

## 5. Verification evidence

| Check | Result |
| ----- | ------ |
| `npm test` (`node --import tsx --test --test-concurrency=1`) | **35/35 pass** |
| Gate — six parallel allocations of the last family room | exactly **1 success**, 5 × `AvailabilityConflictError("stay_overlap")` |
| Gate — raw duplicate `room_nights` insert | rejected (`P2002`) |
| Cancellation → trigger | 4 night rows → **0** after `CANCELLED` |
| Hold window | fresh unpaid `PENDING` blocks → backdated one frees → `PAID` never expires |
| `npm run lint` | **0 problems** |
| `npm run typecheck` | **pass** |
| `npm run db:integrity` | **15/15** |

DB-backed tests run serially (`--test-concurrency=1`), use their own date windows
(2027-03 availability, 2027-04 concurrency) and booking-reference prefixes
(`P4AVAIL-` / `P4CONC-`), and clean up before each test.

---

## 6. Environment note (this machine)

Same constraints as P3: **no network** (npx/npm install hang), no Docker, no system
Postgres. Everything runs on the PGlite wire-protocol server
(`.pglite-data`, port 5432) with Prisma's `@prisma/adapter-pg`. Migration shadow
databases don't exist on PGlite, so `prisma migrate dev` cannot run — hand-written SQL
migration applied with `node node_modules\prisma\build\index.js migrate deploy`.
Test/lint/typecheck all green under these constraints.

---

## 7. Open questions advanced (status stays `open`, reversible defaults recorded)

- **#7** check-in/out times — P4 is date-only; times are P5's concern.
- **#8** same-day turnover — default allowed (`ALLOW_SAME_DAY_TURNOVER=true`).
- **#15** children counting — default children vs `max_children`
  (`CHILDREN_COUNT_AS_ADULTS=false`).
- **#20** (new) pending hold window — `PENDING_HOLD_MINUTES=60`.

---

## 8. Docs updated

- `docs/DEVELOPMENT_PLAN.md` — P4 checked off, gate evidence, deviation note.
- `docs/ERD.md` — cardinality row + `room_nights` design decision (replaces the
  "constraint comes later" note).
- `docs/DATA_DICTIONARY.md` — `room_nights` table, cancel-trigger note, 15 checks.
- `docs/OPEN_QUESTIONS.md` — #7/#8/#15 defaults + new #20.
- `.env.example` — P4 flags block.
- `README.md` — P4 marked done (gate = `npm test`), test instructions, next phase P5.

---

## 9. Git state

Working tree on `main`, **not committed** (no commit was requested). Changed: schema +
new migration, availability source/tests, integrity script, seven docs, `package.json`
(`npm test`), `.env.example`, `.gitignore` (PGlite server logs).

---

## 10. Next steps

1. **P5 — Booking & Checkout**: search form → server-side pricing →
   availability re-check inside the checkout transaction via
   `assertRoomsAvailable`/`createPendingBooking` → `SH-YYYY-NNNNNN` reference
   generator.
2. Standing open questions for P5: #1–#3 (currency/taxes/fees), #9 (cancellation
   window), #11 (confirmed while pending), #12 (special pricing).
