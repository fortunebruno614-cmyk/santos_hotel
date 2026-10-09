# Open Questions — Santo Hotel

Business decisions that must **not** be invented in code (Phase 1 §20). Each blocked
phase references this file. Update `Answer` + `Status` when the hotel confirms.

Status values: `open` · `answered` · `deferred`

## Payment & money

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 1 | What currency will Santo Hotel use? Does it match `MYR` default in `Hotel.currency`? | P5, P6 | open | P5 default (config, reversible): the `hotels` row's currency (fallback `HOTEL_CURRENCY=MYR`) is used for every quote, breakdown and stored amount; quotes echo it so the UI never hardcodes one. |
| 2 | Are taxes included in displayed prices? | P5 | open | P5 default (config, reversible): `TAX_RATE_PERCENT=0` — no tax line until answered; when set, taxes = (subtotal − discount) × rate, computed server-side and re-validated inside the booking transaction. |
| 3 | Are there additional service fees? | P5 | open | P5 default (config, reversible): `SERVICE_FEE=0` — a flat fee charged once per booking when set. |
| 4 | Which payment gateway will be used? | P6 | open | P6 default (config, reversible): none yet — `PAYMENT_PROVIDER=mock` is a fully working local gateway (HMAC-signed webhooks, success/failure/partial-refund, hosted pay page) so the entire money path is live and tested. A real gateway plugs into `src/server/payments/provider.ts` (one registry entry) and one env var; no service, route or test changes. |
| 5 | What happens if payment succeeds but booking creation fails? | P6 | open | P6 default (reversible): the webhook is still accepted (200) and audited as `payment.orphaned` so the provider stops retrying and staff can reconcile; the booking is never created or resurrected by a webhook. In the current flow the booking always exists before payment can be initiated, so this path is a data-anomaly safety net. |
| 6 | What happens to payment/refund when staff cancels a booking? | P6, P7 | open | P6 default (config, reversible): `REFUND_ON_CANCELLATION=true` — cancelling (staff or eligible guest) automatically refunds every captured payment's remaining balance (partial refunds included); the booking's `paymentStatus` becomes REFUNDED/PARTIALLY_REFUNDED in step. Set `false` to leave money captured for manual staff refund from the reservation page. A late success on an already-cancelled booking records the money but never resurrects the reservation — staff refund it. |

## Policies

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 7 | Official check-in and check-out times? | P4, P5 | open | P5 default (config, reversible): `CHECK_IN_TIME=15:00`, `CHECK_OUT_TIME=11:00` — displayed on search/checkout/confirmation and used to anchor the cancellation deadline on the arrival date; the availability engine itself remains date-only. |
| 8 | Is same-day turnover (check-out date = check-in date) allowed? | P4 | open | P4 default (config, reversible): allowed — `ALLOW_SAME_DAY_TURNOVER=true` makes nights half-open `[check_in, check_out)`, so back-to-back stays share no night; set `false` for closed intervals (arrival cannot use the departure date). |
| 9 | What is the cancellation policy (window, fees)? | P5 | open | P5 default (config, reversible): guests may cancel free until `CANCELLATION_WINDOW_HOURS=48` before the check-in instant (check-in time in the hotel timezone); `GUEST_CANCELLATION_ENABLED=false` turns off guest self-service entirely. Staff may cancel any PENDING/CONFIRMED reservation regardless of the window. No fees — refunds are P6. |
| 10 | What is the no-show policy? | P5, P7 | open | P5 default (reversible): NO_SHOW is a terminal status reachable from PENDING/CONFIRMED only on or after the arrival date (hotel timezone); no fees/charges are applied (P6 owns money). |
| 11 | Can a booking be Confirmed while payment is Pending? | P5, P6 | open | P5 default (reversible): yes at the desk — staff walk-ins may create CONFIRMED with `paymentStatus=PENDING` (`confirm: true`); guest checkout always starts PENDING. Payment state changes are P6's. |
| 12 | What rooms or dates have special pricing? | P5 | open | P5 default (data-driven, reversible): the ACTIVE `rates` row whose window covers the night (latest-starting window wins), falling back to `room_types.base_price`; promotions discount the subtotal (capped at it). No seasonal/special-date logic exists yet — adding it needs no schema change. |

## Booking rules

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 13 | Can guests book without an account? | P3, P5 | open | P3 default (config, reversible, not a decision): guest accounts are optional — `GUEST_ACCOUNTS_ENABLED=true`, `GUEST_BOOKING_REQUIRES_ACCOUNT=false`; P5 checkout reads the flag. |
| 14 | Can one booking contain multiple rooms? (schema supports it) | P5 | open | P5 default (reversible): yes — up to `MAX_ROOMS_PER_BOOKING=10` rooms per reservation; occupancy is validated against the combined capacity of the allocation, and every room is priced and allocated in the same transaction. |
| 15 | How are children counted for occupancy? | P4, P5 | open | P4 default (config, reversible): `CHILDREN_COUNT_AS_ADULTS=false` — adults ≤ `max_adults` and children ≤ `max_children`; set `true` to count adults+children against `max_adults` only. |
| 16 | What identification information is required? | P5 | open | P5 default (reversible): optional — `id_type`/`id_number` are accepted at checkout and by the walk-in form and stored on the guest row when given; nothing is enforced until the hotel answers. |
| 17 | Who can cancel or modify reservations? | P3, P7 | open | P3 default (permission map, reversible): `STAFF`/`ADMIN` hold `MANAGE_RESERVATIONS`; which statuses may change, and by whom, is P7. |
| 18 | Who can change room prices? | P3, P7 | open | P3 default (permission map, reversible): `STAFF`/`ADMIN` hold `MANAGE_RATES`; only `ADMIN` holds `MANAGE_USERS` and `MANAGE_AUDIT`. |
| 19 | What notification channels are required (email/SMS/WhatsApp)? | P8 | open | |
| 20 | How long may an unpaid Pending booking hold inventory before it is released? | P4, P6 | open | P4 default (config, reversible): `PENDING_HOLD_MINUTES=60` — unpaid `PENDING` stops blocking after 60 minutes and its `room_nights` rows are swept on the next allocation; `paymentStatus=PAID` never expires. |

## How to use

- A phase must not hardcode an answer to an `open` question above.
- If work is blocked, implement the smallest reversible default behind config and
  record the assumption here.
- P9 gate requires every row to be `answered` or explicitly `deferred`.
