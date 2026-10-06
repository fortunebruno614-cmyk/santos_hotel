# Open Questions — Santo Hotel

Business decisions that must **not** be invented in code (Phase 1 §20). Each blocked
phase references this file. Update `Answer` + `Status` when the hotel confirms.

Status values: `open` · `answered` · `deferred`

## Payment & money

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 1 | What currency will Santo Hotel use? Does it match `MYR` default in `Hotel.currency`? | P5, P6 | open | |
| 2 | Are taxes included in displayed prices? | P5 | open | |
| 3 | Are there additional service fees? | P5 | open | |
| 4 | Which payment gateway will be used? | P6 | open | |
| 5 | What happens if payment succeeds but booking creation fails? | P6 | open | |
| 6 | What happens to payment/refund when staff cancels a booking? | P6, P7 | open | |

## Policies

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 7 | Official check-in and check-out times? | P4, P5 | open | P4 default (dates only, reversible): the availability engine never sees clock times — nights are calendar dates (`room_nights.night`); times are enforced by checkout/operations (P5) when configured. |
| 8 | Is same-day turnover (check-out date = check-in date) allowed? | P4 | open | P4 default (config, reversible): allowed — `ALLOW_SAME_DAY_TURNOVER=true` makes nights half-open `[check_in, check_out)`, so back-to-back stays share no night; set `false` for closed intervals (arrival cannot use the departure date). |
| 9 | What is the cancellation policy (window, fees)? | P5 | open | |
| 10 | What is the no-show policy? | P5, P7 | open | |
| 11 | Can a booking be Confirmed while payment is Pending? | P5, P6 | open | |
| 12 | What rooms or dates have special pricing? | P5 | open | |

## Booking rules

| # | Question | Blocks | Status | Answer |
| - | -------- | ------ | ------ | ------ |
| 13 | Can guests book without an account? | P3, P5 | open | P3 default (config, reversible, not a decision): guest accounts are optional — `GUEST_ACCOUNTS_ENABLED=true`, `GUEST_BOOKING_REQUIRES_ACCOUNT=false`; P5 checkout reads the flag. |
| 14 | Can one booking contain multiple rooms? (schema supports it) | P5 | open | |
| 15 | How are children counted for occupancy? | P4, P5 | open | P4 default (config, reversible): `CHILDREN_COUNT_AS_ADULTS=false` — adults ≤ `max_adults` and children ≤ `max_children`; set `true` to count adults+children against `max_adults` only. |
| 16 | What identification information is required? | P5 | open | |
| 17 | Who can cancel or modify reservations? | P3, P7 | open | P3 default (permission map, reversible): `STAFF`/`ADMIN` hold `MANAGE_RESERVATIONS`; which statuses may change, and by whom, is P7. |
| 18 | Who can change room prices? | P3, P7 | open | P3 default (permission map, reversible): `STAFF`/`ADMIN` hold `MANAGE_RATES`; only `ADMIN` holds `MANAGE_USERS` and `MANAGE_AUDIT`. |
| 19 | What notification channels are required (email/SMS/WhatsApp)? | P8 | open | |
| 20 | How long may an unpaid Pending booking hold inventory before it is released? | P4, P6 | open | P4 default (config, reversible): `PENDING_HOLD_MINUTES=60` — unpaid `PENDING` stops blocking after 60 minutes and its `room_nights` rows are swept on the next allocation; `paymentStatus=PAID` never expires. |

## How to use

- A phase must not hardcode an answer to an `open` question above.
- If work is blocked, implement the smallest reversible default behind config and
  record the assumption here.
- P9 gate requires every row to be `answered` or explicitly `deferred`.
