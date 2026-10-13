-- P7 — Staff/Admin Console.
-- System settings live on the single hotel row (the admin console edits them;
-- `src/config/booking.ts` env vars remain the bootstrap fallback only), plus a
-- key/value table for editable website copy.

-- AlterTable
ALTER TABLE "hotels"
    ADD COLUMN "check_in_time" TEXT NOT NULL DEFAULT '15:00',
    ADD COLUMN "check_out_time" TEXT NOT NULL DEFAULT '11:00',
    ADD COLUMN "tax_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "service_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "cancellation_window_hours" INTEGER NOT NULL DEFAULT 48,
    ADD COLUMN "guest_cancellation_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "max_rooms_per_booking" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business-rule checks (kept in the same style as
-- 20261003040457_add_check_constraints; Prisma does not model CHECKs).
ALTER TABLE "hotels"
  ADD CONSTRAINT "hotels_clock_check" CHECK (
    "check_in_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "check_out_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  ADD CONSTRAINT "hotels_tax_rate_check" CHECK ("tax_rate_percent" >= 0 AND "tax_rate_percent" <= 100),
  ADD CONSTRAINT "hotels_service_fee_check" CHECK ("service_fee" >= 0),
  ADD CONSTRAINT "hotels_cancellation_window_check" CHECK ("cancellation_window_hours" >= 0),
  ADD CONSTRAINT "hotels_max_rooms_check" CHECK ("max_rooms_per_booking" >= 1 AND "max_rooms_per_booking" <= 50);
