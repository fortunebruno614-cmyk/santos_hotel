# Daily Task Report — Santo Hotel

**Date:** Friday, 9 October 2026 (afternoon)
**Scope:** Phase 6 — Payments (provider layer, webhook, refunds, reconciliation)
**Stack:** Next.js 16.3.8 (App Router, TS) · PostgreSQL (PGlite wire-protocol stand-in) · Prisma 7.10.0 · Zod · `node:crypto` HMAC · `node:test`

---

## 1. Summary

| # | Task | Status |
| - | ---- | ------ |
| 1 | Payment config (provider id, webhook secret, refund-on-cancel flag) | Done — `src/config/payments.ts` |
| 2 | Provider-agnostic layer + fully working mock gateway | Done — `src/server/payments/provider.ts` |
| 3 | Payment service: initiate, webhook, refunds, desk capture, settlement | Done — `src/server/payments/service.ts` |
| 4 | Public APIs: initiate, webhook (signature-verified), mock complete | Done — `/api/public/payments/…` |
| 5 | Staff APIs: desk capture / online intent, refund | Done — `/api/staff/payments`, `/api/staff/payments/[id]/refund` |
| 6 | Guest pay page (`/pay/[reference]`) + confirmation payment section | Done |
| 7 | Staff reservation detail: payment list, desk-capture and refund buttons | Done |
| 8 | Cancellation auto-refund wired into both cancel paths (guest + staff) | Done — `settleCancellationPayments` |
| 9 | Audit actions for every money movement | Done — 7 new `payment.*` actions |
| 10 | Tests (initiate, webhook, replay, failure, refund, reconcile, env flag) | Done — 15 P6 tests |
| 11 | **Gate:** failure, retry, replay and refund scenarios all covered | Done — evidence in §5 |
| 12 | Docs (plan, open questions, `.env.example`, README) + daily report | Done |
| 13 | Verification: `npm test` 75/75, `lint` 0, `typecheck` 0 | Done |

---

## 2. Architecture — one seam, one truth

```
guest clicks "Pay"  ──►  POST /api/public/payments/initiate
                         (claim cookie or guest session; find-or-create under
                          booking lock → same providerReference on refresh)
                              │
                              ▼
                    mock hosted page /pay/[ref]
                    (succeed / decline buttons)
                              │
                              ▼
              POST /api/public/payments/mock/complete
              (signs a real event with the webhook secret)
                              │
                              ▼
              POST /api/public/payments/webhook   ◄── a real gateway lands here
              x-payment-signature: <HMAC-SHA256 of the RAW body>
                              │
                              ▼
              handleWebhook (src/server/payments/service.ts)
                1. verify signature against raw body   → 401 if bad
                2. parse + validate event               → 400 if malformed
                3. correlate by unique providerReference
                   ├─ unknown → 200 + audit payment.orphaned (reconcile)
                   └─ known   → lock payment row
                        ├─ amount/currency mismatch → 400, nothing written
                        ├─ succeeded: PENDING → PAID (+paidAt); PENDING booking
                        │             → CONFIRMED; CANCELLED booking untouched
                        ├─ failed:    PENDING → FAILED; booking stays PENDING
                        └─ replay of an applied event → no-op (200)
                4. re-derive booking.paymentStatus from ALL its payments
                5. audit AFTER commit
```

**Why a mock gateway?** The hotel has not confirmed its gateway (#4). Rather
than block P6 or stub the money path, `PAYMENT_PROVIDER=mock` is a *fully
working* local gateway: it issues references, signs webhooks with HMAC-SHA256,
accepts refunds and can succeed or fail on demand. The service only ever talks
to the `PaymentProvider` interface — swapping in Stripe/whoever is one registry
entry and one env var, with zero change to the money logic or its tests. The
mock-complete route signs a genuine event and feeds it through the *same*
`handleWebhook` a real gateway hits, so signature verification, correlation,
idempotency and reconciliation are all exercised end-to-end today.

**Refunds.** Two paths, one function: staff refund manually (full remaining or
partial, from the reservation page) and cancellations auto-refund when
`REFUND_ON_CANCELLATION=true` (#6, default on). Both go through `refundPayment`
→ provider.refund() first; the row only moves to REFUNDED/PARTIALLY_REFUNDED
when the provider accepts, and the booking's `paymentStatus` is re-derived in
the same transaction. A provider failure never un-cancels a reservation — it is
audited as `payment.refund_failed` and staff retry from the UI.

**Reconciliation (#5).** The current flow always creates the booking before
payment can be initiated, so "paid but no booking" is a data anomaly, not a
happy path. The webhook still accepts events for unknown references (200, so
the provider stops retrying) and audits them as `payment.orphaned` for staff to
investigate. A success on a CANCELLED booking records the money but never
resurrects the reservation.

---

## 3. Design decisions

1. **No schema changes.** The P2 `Payment` model already carried provider,
   provider_reference (unique), amount, currency, status, refunded_amount,
   paid_at and refunded_at — and `Booking.paymentStatus` was already the
   guest-facing money state. P6 is service + routes + tests on that model.
2. **Signature over the raw body.** The webhook route reads `request.text()`
   (never a parsed object) and verifies HMAC-SHA256 with `timingSafeEqual`
   before any JSON parsing — a forged or tampered payload cannot reach the
   database.
3. **`booking.paymentStatus` is derived, never hand-set.** Every capture,
   failure and refund re-derives it from the booking's full payment list inside
   the same transaction (`computeBookingPaymentStatus`), so partial refunds,
   retries and mixed desk/online payments always agree with the rows.
4. **Idempotency by locking, not by hoping.** Initiate locks the booking row
   (find-or-create the matching pending intent); the webhook locks the payment
   row (an applied event is a no-op); desk capture locks the booking (a
   double-click cannot capture twice). The unique `provider_reference` is the
   database backstop.
5. **Amount/currency are re-checked at capture.** A webhook whose amount or
   currency disagrees with the stored payment is refused (400) before any write
   — a gateway bug or tampered payload can never mark a booking paid at the
   wrong price.
6. **Audit after commit, everywhere.** `payment.initiate/succeeded/failed/
   refund/refund_failed/desk_capture/orphaned` are written only after their
   transaction commits (same contract as P5), so an audit row always describes
   a change that actually landed.

---

## 4. What was built

| Path | Purpose |
| ---- | ------- |
| `src/config/payments.ts` | `PAYMENT_PROVIDER`, `getWebhookSecret()` (prod-fail-closed), `REFUND_ON_CANCELLATION` |
| `src/server/payments/provider.ts` | `PaymentProvider` interface, mock gateway (HMAC sign/verify, intents, refunds), registry |
| `src/server/payments/service.ts` | `initiatePayment`, `handleWebhook`, `refundPayment`, `refundCapturedPayments`, `settleCancellationPayments`, `recordDeskPayment`, `computeBookingPaymentStatus`, `getPaymentsForBooking` |
| `src/app/api/public/payments/initiate/route.ts` | POST — claim/session-gated, idempotent |
| `src/app/api/public/payments/webhook/route.ts` | POST — signature-verified, replay-safe |
| `src/app/api/public/payments/mock/complete/route.ts` | POST — mock gateway redirect (signs a real event → `handleWebhook`) |
| `src/app/api/staff/payments/route.ts` | POST — desk capture or online intent (`MANAGE_PAYMENTS`) |
| `src/app/api/staff/payments/[id]/refund/route.ts` | POST — full/partial refund (`MANAGE_PAYMENTS`) |
| `src/app/pay/[reference]/page.tsx` + `pay-buttons.tsx` | Guest mock pay page (succeed/decline) |
| `src/app/booking/confirmation/page.tsx` | + payment section with "Pay now" when unpaid |
| `src/app/admin/bookings/[id]/payment-actions.tsx` | Staff payment list, desk-capture and refund buttons |
| `src/server/booking/{service,http,validation}.ts` | + payments in `BookingDetail`, `settleCancellationPayments` in both cancel paths, `PaymentError` mapping, payment zod schemas |
| `src/server/audit/write.ts` | + 7 `payment.*` audit actions |
| `src/config/access-map.ts` | `open("/pay")`, `staff("/api/staff/payments", …, "MANAGE_PAYMENTS")` |
| `tests/payments/{payments,refund-flag}.test.ts` | 15 tests |

---

## 5. Verification evidence

| Check | Result |
| ----- | ------ |
| `npm test` | **75/75 pass** (35 P4 + 25 P5 + 15 P6) |
| Gate — initiate idempotency | second initiate returns the same intent (same id + providerReference); only 1 payment row |
| Gate — success | signed webhook → payment PAID (+paidAt), booking PENDING→CONFIRMED, paymentStatus PAID |
| Gate — replay | same event twice → second is `replay`, still 1 capture audit row, nothing double-applied |
| Gate — failure | `payment.failed` → payment FAILED, booking stays PENDING (never Confirmed as paid) |
| Gate — signature | null / wrong signature → `invalid_signature` before any write; payment stays PENDING |
| Gate — amount mismatch | event amount +1.00 → `amount_mismatch`, nothing written |
| Gate — reconcile | unknown reference → 200 `orphaned` + `payment.orphaned` audit row |
| Gate — paid-after-cancel | late success on CANCELLED booking → money recorded, booking stays CANCELLED |
| Gate — desk capture | PAID + CONFIRMED immediately; second capture → `already_paid`, 1 row |
| Gate — full refund | payment REFUNDED, booking paymentStatus REFUNDED |
| Gate — partial refund | PARTIALLY_REFUNDED, balance remaining, then top-up refund → REFUNDED |
| Gate — over-refund | amount > remaining → `refund_exceeds_paid`, payment unchanged |
| Gate — cancel refunds | staff cancel of a PAID booking → payment REFUNDED (default flag on) |
| Gate — env flag | `REFUND_ON_CANCELLATION=false` (separate process) → cancel leaves payment PAID |
| Provider contract | configured provider signs and verifies; tampered body fails verification |
| `npm run lint` | **0 problems** |
| `npm run typecheck` | **pass** |

P6 tests use their own guests (`%@p6.test`, swept before each test, payments
deleted before bookings because of the Restrict relation) and date windows
(2027-09…11) so they cannot collide with P4/P5 fixtures.

---

## 6. Environment note (this machine)

Same constraints as P3–P5: PGlite wire-protocol server on `127.0.0.1:5432`
(`.pglite-data`). No new hazards this phase — the webhook path is pure service
code (no interactive-transaction deadlock risk beyond the P5 fix that is already
in place), and the mock provider needs no network.

---

## 7. Open questions advanced (status stays `open`, reversible defaults recorded)

- **#4** gateway — `PAYMENT_PROVIDER=mock` is a fully working local gateway;
  a real one is one registry entry + one env var, no service/test changes.
- **#5** paid-but-no-booking — webhook accepted (200) + audited as
  `payment.orphaned`; the booking is never created or resurrected by a webhook.
- **#6** refund on cancel — `REFUND_ON_CANCELLATION=true` auto-refunds every
  captured payment's remaining balance after the cancellation commits; `false`
  leaves money captured for manual staff refund. Late success on a cancelled
  booking records the money, never resurrects the reservation.

---

## 8. Git state

Committed on `main`: **`43d625f`** — *P6: payments with signed webhooks,
idempotent capture, refunds and reconciliation* (26 files, 2,277 insertions).
Contains the payments config/provider/service, 5 API routes, guest pay page,
staff payment panel, booking-service settlement hooks, 2 test files, helpers
extension, and the plan/questions/env/README docs.

---

## 9. Next steps

1. **P7 — Staff/Admin Console**: dashboard (today's arrivals/departures,
   occupancy), CRUD for room types/rooms/amenities/rates/promotions, guest and
   payment record screens, system settings. The reservation list, room board and
   payment panel built in P5/P6 are the first three console modules.
2. **P8 — Notifications** (#19 still open): email/SMS/WhatsApp channels — the
   `notifications` table has been ready since P2.
3. When the hotel answers **#4**, replace the mock: add the gateway to
   `src/server/payments/provider.ts`, set `PAYMENT_PROVIDER`, and point the
   provider's live webhook at `/api/public/payments/webhook`.
