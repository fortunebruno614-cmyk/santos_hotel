# Phase Delivery Report — P6 Payments

**Project:** Santo Hotel booking system
**Phase:** P6 — Payments
**Delivered:** Friday, 9 October 2026
**Commit:** `43d625f` (pushed to `origin/main`)
**Gate status:** PASSED — `npm test` 75/75 · `npm run lint` 0 · `npm run typecheck` 0

---

## 1. What this phase delivered

A complete, tested money path for the hotel: guests can pay for a reservation
online, staff can take payments at the desk and issue refunds, and **a booking
only ever counts as paid when a signed provider event says so**.

| Capability | Where it lives |
| ---------- | -------------- |
| Guest pays online (mock gateway, full signed-webhook flow) | `/pay/[reference]` + `/api/public/payments/*` |
| "Pay now" from the confirmation page | `/booking/confirmation` |
| Staff records a walk-in cash/card payment | Reservation detail → *Record desk payment* |
| Staff issues a full or partial refund | Reservation detail → *Refund remaining* |
| Cancellation auto-refunds captured money | Both cancel paths (guest + staff), config flag |
| Webhook endpoint ready for a real gateway | `POST /api/public/payments/webhook` |

---

## 2. The guarantees (why this can be trusted with money)

1. **No booking is `PAID` without a verified provider event.** The only paths
   to `paymentStatus=PAID` are a signature-verified webhook or an explicit
   staff desk capture — both audited.
2. **Refreshing the pay page cannot double-charge.** `initiatePayment` is
   find-or-create under a booking lock: the second call returns the *same*
   pending intent with the *same* `providerReference`.
3. **A replayed webhook cannot double-record.** The payment row is locked and
   an already-applied event is a no-op — proven by test (one capture audit row
   after two identical deliveries).
4. **A failed payment never confirms a booking.** The booking stays
   `PENDING`/unpaid; the guest can retry with a fresh intent.
5. **A forged or tampered webhook never reaches the database.** HMAC-SHA256 is
   verified against the **raw request body** with a constant-time comparison
   *before* any JSON parsing; amount and currency are re-checked against the
   stored payment at capture time.
6. **A late success on a cancelled booking never resurrects it.** The money is
   recorded (it did move) and staff refund it; the reservation stays
   `CANCELLED`.
7. **`booking.paymentStatus` is derived, never hand-written.** It is recomputed
   from the booking's full payment list inside every capture/refund
   transaction, so partial refunds, retries and mixed desk/online payments
   always agree with the rows.
8. **Every money movement is audited after commit** — `payment.initiate`,
   `payment.succeeded`, `payment.failed`, `payment.refund`,
   `payment.refund_failed`, `payment.desk_capture`, `payment.orphaned`.

---

## 3. The gateway question (#4) — solved without guessing

The hotel has not chosen a payment gateway. Rather than block the phase or
stub the money path, P6 ships a **provider-agnostic layer** with a fully
working **mock gateway** as the default:

- `PAYMENT_PROVIDER=mock` (env) selects it from a registry.
- The mock issues references (`mock_<24 hex>`), signs and verifies real
  HMAC-SHA256 webhooks, accepts refunds, and can succeed or fail on demand.
- The guest "payment page" posts to a mock-complete route that signs a
  genuine event and feeds it through the **same** `handleWebhook` a real
  gateway would hit — so signature verification, correlation, idempotency and
  reconciliation are exercised end-to-end today, not stubbed.

**When the hotel picks a real gateway**, the swap is:

1. Implement `PaymentProvider` (4 methods) in `src/server/payments/provider.ts`
   and register it.
2. Set `PAYMENT_PROVIDER=<id>` and `PAYMENT_WEBHOOK_SECRET=<secret>` in the env.
3. Point the gateway's live webhook at `POST /api/public/payments/webhook`.

No service, route, UI or test changes are required — the money logic is
already proven against the interface.

---

## 4. Configuration reference

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `PAYMENT_PROVIDER` | `mock` | Provider id from the registry |
| `PAYMENT_WEBHOOK_SECRET` | falls back to `SESSION_SECRET` | HMAC secret for webhook payloads; **required in production** (the app refuses to verify without it) |
| `REFUND_ON_CANCELLATION` | `true` | Cancelled bookings auto-refund captured money; `false` = staff refund manually |

All three are reversible defaults for open questions #4–#6
(`docs/OPEN_QUESTIONS.md`) — none is a decision, all are env vars.

---

## 5. API surface

| Route | Method | Who | Does |
| ----- | ------ | --- | ---- |
| `/api/public/payments/initiate` | POST | guest session or claim cookie | Find-or-create the pending intent; returns `checkoutPath` |
| `/api/public/payments/webhook` | POST | anyone with the HMAC secret | Signature-verified capture/failure; replay-safe |
| `/api/public/payments/mock/complete` | POST | guest session or claim cookie | Mock gateway redirect (signs a real event → webhook path) |
| `/api/staff/payments` | POST | staff (`MANAGE_PAYMENTS`) | Desk capture (`mode:"desk"`) or online intent (`mode:"online"`) |
| `/api/staff/payments/{id}/refund` | POST | staff (`MANAGE_PAYMENTS`) | Full remaining or partial refund |

Ownership failures answer **404, never 403** (a stranger must not learn a
booking exists) — same contract as P5.

---

## 6. Test matrix (15 tests, all passing)

| Scenario | Asserted behaviour |
| -------- | ------------------ |
| Initiate ×2 (page refresh) | Same intent id + providerReference; 1 payment row |
| Signed success webhook | Payment PAID (+paidAt), booking PENDING→CONFIRMED |
| Replay of the same event | `replay` outcome; still exactly 1 capture audit row |
| Failed payment | Payment FAILED; booking stays PENDING |
| Null / wrong signature | `invalid_signature` before any write |
| Amount +1.00 vs stored | `amount_mismatch`; nothing written |
| Unknown provider reference | 200 `orphaned` + audit row (reconciliation) |
| Success on CANCELLED booking | Money recorded; booking stays CANCELLED |
| Desk capture ×2 | First: PAID+CONFIRMED; second: `already_paid`; 1 row |
| Full refund | Payment + booking → REFUNDED |
| Partial refund → top-up | PARTIALLY_REFUNDED, then REFUNDED |
| Over-refund | `refund_exceeds_paid`; payment unchanged |
| Staff cancel of a PAID booking | Payment auto-REFUNDED (default flag on) |
| `REFUND_ON_CANCELLATION=false` (separate process) | Cancel leaves payment PAID for manual refund |
| Provider contract | Configured provider signs/verifies; tampered body fails |

Full suite after this phase: **75/75** (35 availability + 25 booking + 15
payments). P6 fixtures use their own guests (`%@p6.test`) and date windows
(2027-09…11) so they cannot collide with earlier phases.

---

## 7. Deliberately out of scope

- **A real gateway** — blocked on open question #4; the seam is ready (§3).
- **Installment / deposit payments** — one payment intent per booking total;
  the schema and `PARTIALLY_REFUNDED` state already support extending this.
- **Currency conversion** — payments are charged in the hotel's currency and
  the webhook re-checks it; conversion is a gateway concern.
- **PCI/card data** — never touched, never stored; only provider references
  and amounts live in our database (P2 schema contract).

---

## 8. How to verify this phase yourself

```bash
npm run db:migrate && npm run db:seed   # once
npm test                                # 75/75 including tests/payments/
npm run lint && npm run typecheck
```

Manual walkthrough (dev server):

1. Search → book a room → on the confirmation page click **Pay … now**.
2. On `/pay/[reference]` click **Pay now** → redirected to confirmation, now
   **Paid in full**; booking status **Confirmed**.
3. Or click **Simulate declined card** → payment FAILED, booking still Pending.
4. Staff: `/admin/bookings/[id]` → *Record desk payment* or *Refund remaining*.
5. Cancel a paid reservation → payment becomes REFUNDED automatically
   (or stays PAID with `REFUND_ON_CANCELLATION=false`).

---

## 9. Files delivered (26 changed, +2,277 lines)

| Area | Files |
| ---- | ----- |
| Config | `src/config/payments.ts` |
| Provider layer | `src/server/payments/provider.ts` |
| Service | `src/server/payments/service.ts` |
| Public API | `api/public/payments/{initiate,webhook,mock/complete}/route.ts` |
| Staff API | `api/staff/payments/route.ts`, `api/staff/payments/[id]/refund/route.ts` |
| Guest UI | `app/pay/[reference]/{page.tsx,pay-buttons.tsx}`, confirmation payment section |
| Staff UI | `app/admin/bookings/[id]/payment-actions.tsx` |
| Integration | booking service (settlement hooks, payments in detail), http error map, validation schemas, access map, audit actions |
| Tests | `tests/payments/{payments,refund-flag}.test.ts`, helpers extension |
| Docs | plan, open questions #4–#6, `.env.example`, README, this report |

---

## 10. Next phase

**P7 — Staff/Admin Console** (dashboard, CRUD for room types/rooms/rates/
promotions, guest and payment record screens, system settings). The
reservation list (P5), room status board (P5) and payment panel (P6) are the
first three console modules already delivered.
