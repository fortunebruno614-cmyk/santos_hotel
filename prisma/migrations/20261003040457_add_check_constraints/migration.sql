-- Business-rule checks the database should enforce (Phase 2 §19).
-- Prisma does not model CHECK constraints; keep this migration in sync manually.

-- Booking dates and amounts
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_dates_check" CHECK ("check_out" > "check_in"),
  ADD CONSTRAINT "bookings_adults_check" CHECK ("adults" >= 1),
  ADD CONSTRAINT "bookings_children_check" CHECK ("children" >= 0),
  ADD CONSTRAINT "bookings_amounts_check" CHECK (
    "subtotal" >= 0 AND "taxes" >= 0 AND "fees" >= 0 AND "discount" >= 0 AND "total" >= 0
  );

-- Room allocation snapshots
ALTER TABLE "booking_rooms"
  ADD CONSTRAINT "booking_rooms_nights_check" CHECK ("nights" >= 1),
  ADD CONSTRAINT "booking_rooms_amounts_check" CHECK ("nightly_rate" >= 0 AND "room_total" >= 0);

-- Rates
ALTER TABLE "rates"
  ADD CONSTRAINT "rates_dates_check" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "rates_amount_check" CHECK ("amount" >= 0);

-- Promotions
ALTER TABLE "promotions"
  ADD CONSTRAINT "promotions_dates_check" CHECK ("end_at" > "start_at"),
  ADD CONSTRAINT "promotions_value_check" CHECK ("value" > 0),
  ADD CONSTRAINT "promotions_max_uses_check" CHECK ("max_uses" IS NULL OR "max_uses" > 0);

-- Payments
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amounts_check" CHECK (
    "amount" >= 0 AND "refunded_amount" >= 0 AND "refunded_amount" <= "amount"
  );

-- Room type capacity
ALTER TABLE "room_types"
  ADD CONSTRAINT "room_types_capacity_check" CHECK ("max_adults" >= 1 AND "max_children" >= 0);
