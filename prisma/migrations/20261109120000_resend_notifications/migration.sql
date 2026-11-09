-- Resend email notifications: durable delivery log + idempotency.
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_id" TEXT;

-- One row per business event/recipient. Multiple NULLs are allowed, so older
-- rows (and non-deduped test sends) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key"
  ON "notifications"("dedupe_key");

CREATE INDEX IF NOT EXISTS "notifications_hotel_id_created_at_idx"
  ON "notifications"("hotel_id", "created_at");

CREATE INDEX IF NOT EXISTS "notifications_created_at_idx"
  ON "notifications"("created_at");
