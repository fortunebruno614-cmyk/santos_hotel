-- P2.3 Indexes — each index justified by the query it serves (see docs/DATA_DICTIONARY.md).
--
-- bookings:
--   * bookings_booking_reference_key (unique, from 20261003040431)  →
--       SELECT * FROM bookings WHERE booking_reference = 'SH-2026-000123'
--   * bookings_guest_id_idx →
--       SELECT * FROM bookings WHERE guest_id = $1 ORDER BY created_at DESC  (guest history)
--   * bookings_check_in_check_out_idx replaces bookings_check_in_idx; the leading
--     column still serves every check_in lookup/range (arrivals calendar) and the
--     pair matches the overlap predicate:
--       check_in < $requested_out AND check_out > $requested_in
--   * bookings_check_out_idx →
--       SELECT * FROM bookings WHERE check_out = CURRENT_DATE  (departures board)
--   * bookings_booking_status_check_in_check_out_idx replaces
--     bookings_booking_status_idx; leading column still serves
--       WHERE booking_status = $1  (dashboard counts / filters)
--     and the full triple narrows the availability overlap query to live bookings.
--
-- rooms:
--   * rooms_room_type_id_idx →
--       SELECT * FROM rooms WHERE room_type_id = $1  (category inventory)
--   * rooms_status_idx →
--       SELECT * FROM rooms WHERE status = 'AVAILABLE'  (housekeeping/front desk board)
--
-- booking_rooms:
--   * booking_rooms_booking_id_room_id_key (unique, from 20261003040431) →
--       SELECT * FROM booking_rooms WHERE booking_id = $1  (leading column prefix)
--   * booking_rooms_room_id_booking_id_idx replaces booking_rooms_room_id_idx:
--     the availability/exclusion query
--       SELECT br.booking_id FROM booking_rooms br WHERE br.room_id = ANY($rooms)
--     becomes index-only, and the join back to bookings is a PK probe.
--
-- payments:
--   * payments_booking_id_idx →
--       SELECT * FROM payments WHERE booking_id = $1  (booking payment panel)
--   * payments_provider_reference_key (unique, from 20261003040449) →
--       SELECT * FROM payments WHERE provider_reference = $1  (webhook idempotency)

-- DropIndex
DROP INDEX IF EXISTS "bookings_check_in_idx";
DROP INDEX IF EXISTS "bookings_booking_status_idx";
DROP INDEX IF EXISTS "booking_rooms_room_id_idx";

-- CreateIndex
CREATE INDEX "bookings_check_in_check_out_idx" ON "bookings"("check_in", "check_out");

-- CreateIndex
CREATE INDEX "bookings_booking_status_check_in_check_out_idx" ON "bookings"("booking_status", "check_in", "check_out");

-- CreateIndex
CREATE INDEX "booking_rooms_room_id_booking_id_idx" ON "booking_rooms"("room_id", "booking_id");
