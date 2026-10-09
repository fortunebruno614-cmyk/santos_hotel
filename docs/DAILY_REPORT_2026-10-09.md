# Daily Task Report — Santo Hotel

**Date:** Friday, 9 October 2026
**Scope:** Phase 5 — Booking & Checkout (guest flow, staff desk, cancellation policy)
**Stack:** Next.js 16.3.8 (App Router, TS) · PostgreSQL (PGlite wire-protocol stand-in) · Prisma 7.10.0 · Zod · `jose` · `node:test`

---

## 1. Summary

| # | Task | Status |
| - | ---- | ------ |
| 1 | Pricing service (rate windows, promotions, taxes/fees, money model) | Done — `src/server/pricing/` |
| 2 | Booking service: checkout, transitions, cancellation, modify, notes, room status | Done — `src/server/booking/service.ts` + `policy.ts` |
| 3 | `SH-YYYY-NNNNNN` reference generator with unique-constraint retry | Done — `src/server/booking/reference.ts` |
| 4 | Wire validation + unified API error mapping | Done — `validation.ts`, `http.ts` |
| 5 | Public APIs: quote, checkout (claim cookie), claim cancellation | Done — `/api/public/quote`, `/api/public/checkout`, `/api/public/bookings/[reference]/cancel` |
| 6 | Staff APIs: bookings list/create/detail/modify/transition/notes, room status | Done — `/api/staff/bookings…`, `/api/staff/rooms/[id]` |
| 7 | Public site: home, search, rooms, room detail, booking, confirmation | Done — `/`, `/search`, `/rooms`, `/rooms/[slug]`, `/booking`, `/booking/confirmation` |
| 8 | Guest area: upcoming/past split + eligible cancellation | Done — `/account` |
| 9 | Staff console: reservation list, walk-in form, detail actions, room board | Done — `/admin/bookings`, `/admin/bookings/new`, `/admin/bookings/[id]`, `/admin/rooms` |
| 10 | Tests (checkout, lifecycle, modify, env flag) | Done — 25 P5 tests |
| 11 | **Gate:** no booking bypasses the availability re-check; stored price = quoted price | Done — evidence in §5 |
| 12 | Docs (plan, open questions, `.env.example`) + daily report | Done |
| 13 | Verification: `npm test` 60/60, `lint` 0, `typecheck` 0 | Done |

---

## 2. Architecture — one gate, priced twice

```
/search  ──findAvailability──► room types + free rooms + "from" prices
/booking ──computeQuote──────► exact quote (rate × nights, discount, taxes, fees)
   │  client posts expectedTotal to /api/public/checkout (or /api/staff/bookings)
   ▼
createBooking (src/server/booking/service.ts)
   1. resolve guest (session id wins; else match email; else create passwordless row)
   2. computeQuote  → compare with expectedTotal           → price_changed (409)
   3. createPendingBooking (ONE transaction):
        lock rooms (sorted) → releaseExpiredHolds → assertRoomsAvailable
        → re-price (priceCheck) and require snapshotsEqual → PriceChangedError
        → INSERT bookings + booking_rooms (+ room_nights via PK backstop)
   4. audit log AFTER commit
```

The quote shown, the quote compared and the quote stored are the same function
(`computeQuote`), and step 3 re-runs it under the room locks — a stored price can never
disagree with the price the guest saw, and a room taken between quote and checkout is
rejected with `stay_overlap` (409).

**Status transitions** are a server-side table (`policy.ts`), never a UI choice:
`PENDING → CONFIRMED | CANCELLED | NO_SHOW`, `CONFIRMED → CHECKED_IN | CANCELLED | NO_SHOW`,
`CHECKED_IN → CHECKED_OUT`, terminals have no exits. Check-in/out/no-show additionally
require the arrival date (hotel timezone) to have arrived. Check-in flips allocated rooms
to `OCCUPIED`; check-out sends only the rooms that were occupied to `CLEANING` — the
`CheckedOut → Cleaning → Available` flow, with `OCCUPIED → AVAILABLE` deliberately illegal.

**Cancellation** = transition to `CANCELLED` + policy evaluation: guests bound by
`CANCELLATION_WINDOW_HOURS=48` before the check-in instant (check-in time, hotel tz) and
`GUEST_CANCELLATION_ENABLED`; staff bypass the window for PENDING/CONFIRMED. The DB
trigger (P4) releases the nights.

**Anonymous bookings** (open question #13, flag off) get a signed, httpOnly
`booking_claim` cookie (JWT, 24h, session secret) scoped to that one reference — enough
for the confirmation page and an eligible cancel, never a session substitute.

---

## 3. Design decisions

1. **No schema changes.** `Booking` already carried money columns, promotion snapshot,
   `created_by_user_id` and `notes`; `Guest` already had `id_type`/`id_number`. P5 is
   service + UI + tests on the P2 model.
2. **Aggregate capacity for multi-room allocations** (#14): `assertRoomsAvailable`
   validates the party against the *combined* capacity of the selected rooms (identical
   to the old rule for a single room). `findAvailability`'s per-type filter is unchanged
   (P4 tests depend on it); the multi-room case is a checkout-time concern.
3. **Reference race = retry.** `SH-YYYY-NNNNNN` is derived from the max sequence for the
   year; two concurrent checkouts resolve through the unique constraint — the loser
   catches `P2002` on `booking_reference` and re-rolls (≤ `BOOKING_REFERENCE_ATTEMPTS`).
4. **`loadHotelContext(client)`** — pricing inside the booking transaction must read the
   hotel row *through the transaction's own client*: on PGlite (single backend) a second
   connection deadlocks against the open transaction; on Postgres it would be a wasted
   round-trip that cannot see uncommitted writes. Found by the first test run, fixed in
   `src/server/pricing/context.ts`.
5. **Notes are append-only lines** (`[ISO-stamp actor] text`) so desk history survives
   edits; every write is mirrored to `audit_log` *after* the transaction commits.
6. **Errors are one vocabulary** (`http.ts`): 400 validation/promotion, 403
   account/permission, 404 not-found (ownership failures are 404, never 403), 409
   conflicts (price changed, unavailable, invalid transition), 500 never leaks internals.

---

## 4. What was built

| Path | Purpose |
| ---- | ------- |
| `src/config/booking.ts` | currency, tax, fee, times, cancellation window/flag, max rooms, reference format |
| `src/server/pricing/model.ts` | Decimal money helpers, `PricingSnapshot`, `PriceChangedError`, `snapshotsEqual` |
| `src/server/pricing/context.ts` | hotel currency/timezone/times; `hotelToday`, `zonedToUtc`, `formatMoney` |
| `src/server/pricing/service.ts` | `computeQuote`/`buildQuote`/`computeTypePrices`, promotion evaluation (locked in-tx) |
| `src/server/booking/reference.ts` | `SH-YYYY-NNNNNN` format/parse/generate + conflict detection |
| `src/server/booking/policy.ts` | transition tables, timing guards, cancellation evaluation, room transitions |
| `src/server/booking/validation.ts` | zod schemas for every API edge |
| `src/server/booking/claim.ts` | signed `booking_claim` cookie (24h) |
| `src/server/booking/service.ts` | `createBooking`, `cancelBooking(ByClaim)`, `transitionBooking`, `modifyBooking`, `addBookingNote`, `updateRoomStatus`, `getBookingDetail(ByReference)` |
| `src/server/booking/http.ts` | unified error → status mapping |
| `src/app/api/public/quote/route.ts` | GET quote (availability-checked) |
| `src/app/api/public/checkout/route.ts` | POST checkout + claim cookie |
| `src/app/api/public/bookings/[reference]/cancel/route.ts` | claim-based cancellation |
| `src/app/api/staff/bookings/route.ts` (+ `[id]`, `transition`, `notes`) | staff reservation APIs |
| `src/app/api/staff/rooms/[id]/route.ts` | room status transitions |
| `src/app/api/account/bookings/[id]/cancel/route.ts` | guest cancellation |
| `src/app/{search,rooms,rooms/[slug],booking,booking/confirmation,account}` | public site + guest area |
| `src/app/admin/{bookings,bookings/new,bookings/[id],rooms}` | staff console (+ nav in `admin/layout.tsx`) |
| `src/components/site-header.tsx`, `src/components/labels.ts` | public chrome, status labels |
| `tests/booking/*.test.ts` | 25 tests across checkout, lifecycle, modify, env flag |

---

## 5. Verification evidence

| Check | Result |
| ----- | ------ |
| `npm test` | **60/60 pass** (35 P4 + 25 P5) |
| Gate — checkout re-check | second checkout of an occupied room → `AvailabilityConflictError("stay_overlap")` |
| Gate — price integrity | `expectedTotal` off by 1.00 → `price_changed`, **0 rows written**; in-tx re-price uses the same `computeQuote` |
| Reference format | every booking matches `SH-\d{4}-\d{6}`; generator advances; `P2002` retry path coded |
| Cancellation window | arrival tomorrow + 48h window → guest `too_late_to_cancel`, staff succeeds |
| Transition guards | `PENDING→CHECKED_OUT` `invalid_transition`; `CONFIRMED→CHECKED_IN` before arrival `check_in_not_allowed`; check-in → `OCCUPIED`; check-out → `CLEANING` |
| Room board | `OCCUPIED→AVAILABLE` rejected; `OCCUPIED→CLEANING→AVAILABLE` accepted |
| Modification | date change re-prices (4 nights cost more than 2); room swap moves nights; collision → `stay_overlap` with original allocation intact |
| Claim cancellation | valid claim cancels; claim naming another guest → `booking_not_found` |
| `GUEST_BOOKING_REQUIRES_ACCOUNT=true` | anonymous refused (`account_required`), signed-in guest still books (separate process, env-before-import) |
| `npm run lint` | **0 problems** |
| `npm run typecheck` | **pass** |

P5 tests use their own guests (`%@p5.test`, swept before each test) and date windows
(2027-07/08 + relative dates for timing rules) so they cannot collide with P4 fixtures.

---

## 6. Environment note (this machine)

Same constraints as P3/P4: PGlite wire-protocol server on `127.0.0.1:5432` (`.pglite-data`).
The P5 suite surfaced a real single-backend hazard: **never touch the global Prisma client
inside an interactive transaction** — every in-tx query must go through `tx` (`loadHotelContext`
now takes the client). That fix is what turned the first all-red run into 25/25.

---

## 7. Open questions advanced (status stays `open`, reversible defaults recorded)

- **#1** currency — hotel row, fallback `HOTEL_CURRENCY=MYR`, echoed by every quote.
- **#2/#3** taxes/fees — `TAX_RATE_PERCENT=0`, `SERVICE_FEE=0` (both config).
- **#7** times — `CHECK_IN_TIME=15:00`, `CHECK_OUT_TIME=11:00` (display + deadline anchor).
- **#9** cancellation — 48h window before check-in instant; guest flag; staff bypass.
- **#10** no-show — terminal, arrival-date-only, no fees (P6).
- **#11** confirmed while pending — allowed at the desk (`confirm: true`), payment stays PENDING.
- **#12** special pricing — ACTIVE rate windows + base-price fallback + promotions; no seasonal logic.
- **#14** multi-room — yes, ≤ 10 rooms, aggregate capacity.
- **#16** ID — optional fields, stored when given.

---

## 8. Git state

Committed on `main` as a single phase-sized commit: pricing/booking servers, 12 API
routes, 10 pages/components, 4 test files, helpers extension, and the plan/questions/env
docs. See `git log` for the P5 commit hash.

---

## 9. Next steps

1. **P6 — Payments**: gateway choice (#4) blocks the provider integration; webhook +
   idempotency + refund-on-cancel (#5/#6) are already shaped by P5's `payment_status`.
2. **P7 — Staff console**: dashboard (arrivals/departures/occupancy), CRUD for room
   types/rooms/rates/promotions — the reservation and room boards built in P5 are the
   first two console modules.
