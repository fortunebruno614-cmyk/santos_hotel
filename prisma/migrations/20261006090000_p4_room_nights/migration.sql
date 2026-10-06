-- P4 — Availability Engine: `room_nights` ledger = the database-level
-- double-booking guard promised by docs/ERD.md ("the DB-level exclusion
-- constraint is added in P4").
--
-- Shape: one row per room per sold calendar night, PRIMARY KEY (room_id, night).
-- Two live allocations of the same room for the same night are then a primary-key
-- violation — impossible under any code path, including concurrent transactions
-- (Postgres serialises conflicting inserts on the key). This is deliberately a
-- per-night key instead of a `btree_gist` exclusion constraint over date ranges:
--   * no extension dependency (works on vanilla Postgres *and* the PGlite dev
--     stand-in, which cannot load `btree_gist`);
--   * half-open `[check_in, check_out)` nights encode same-day turnover
--     (docs/OPEN_QUESTIONS.md #8) structurally — the departing guest's last night
--     is checkout-minus-one, so the arriving guest may take the checkout date;
--   * release is explicit (delete the rows), so `CANCELLED` / expired-hold
--     bookings free inventory without a status column inside a constraint predicate.
--
-- Index justification:
--   * `room_nights_pkey` (room_id, night) → the conflict check itself, plus
--     "is this room sold tonight": `WHERE room_id = $1 AND night = ANY($nights)`.
--   * `room_nights_booking_id_idx` → release/cascade per booking:
--     `DELETE FROM room_nights WHERE booking_id = $1` (cancel trigger, hold sweep).

-- CreateTable
CREATE TABLE "room_nights" (
    "night" DATE NOT NULL,
    "room_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_nights_pkey" PRIMARY KEY ("room_id","night")
);

-- CreateIndex
CREATE INDEX "room_nights_booking_id_idx" ON "room_nights"("booking_id");

-- AddForeignKey
ALTER TABLE "room_nights" ADD CONSTRAINT "room_nights_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_nights" ADD CONSTRAINT "room_nights_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: existing allocations become nights exactly when they block inventory
-- under the P4 policy (see src/server/availability/service.ts — the same rule):
--   * `CANCELLED` never blocks;
--   * unpaid `PENDING` blocks only inside the hold window
--     (`PENDING_HOLD_MINUTES`, default 60 — keep in sync with src/config/availability.ts);
--   * every other status blocks.
-- No `ON CONFLICT DO NOTHING`: pre-existing overlapping allocations are a data bug
-- this migration must surface instead of silently under-blocking.
INSERT INTO "room_nights" ("night", "room_id", "booking_id")
SELECT d::date, br."room_id", br."booking_id"
FROM "booking_rooms" br
JOIN "bookings" b ON b."id" = br."booking_id"
CROSS JOIN LATERAL generate_series(b."check_in", b."check_out" - 1, INTERVAL '1 day') AS d
WHERE b."booking_status" <> 'CANCELLED'
  AND (
    b."booking_status" <> 'PENDING'
    OR b."payment_status" = 'PAID'
    OR b."created_at" >= NOW() - INTERVAL '60 minutes'
  );

-- Cancellation releases the sold nights: `bookings.booking_status` is the policy,
-- the night rows are the mechanism. Written as a trigger (not an app hook) so no
-- future code path — P5 checkout, P7 console, a manual SQL fix — can cancel a
-- booking and keep its inventory locked. Reactivating a cancelled booking must go
-- through the availability service, which re-creates the nights and therefore
-- re-runs the conflict check (fail closed if the room was resold).
CREATE FUNCTION "release_room_nights_on_cancel"() RETURNS trigger AS $$
BEGIN
  IF NEW."booking_status" = 'CANCELLED' AND OLD."booking_status" <> 'CANCELLED' THEN
    DELETE FROM "room_nights" WHERE "booking_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bookings_release_room_nights"
AFTER UPDATE OF "booking_status" ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "release_room_nights_on_cancel"();
