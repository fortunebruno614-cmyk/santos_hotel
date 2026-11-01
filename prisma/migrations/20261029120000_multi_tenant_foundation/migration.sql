-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPPORT', 'OPERATIONS', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyPublicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PUBLISHED', 'PAUSED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LocationVerification" AS ENUM ('NONE', 'PLATFORM_VERIFIED');

-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('NONE', 'APPROXIMATE', 'NEIGHBORHOOD', 'EXACT');

-- CreateEnum
CREATE TYPE "RecordScope" AS ENUM ('PLATFORM', 'TENANT');

-- AlterTable
ALTER TABLE "amenities" ADD COLUMN "organization_id" UUID,
ADD COLUMN "scope" "RecordScope" NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "actor_guest_id" UUID,
ADD COLUMN "actor_type" TEXT,
ADD COLUMN "hotel_id" UUID,
ADD COLUMN "ip_address" TEXT,
ADD COLUMN "organization_id" UUID,
ADD COLUMN "outcome" TEXT,
ADD COLUMN "purpose" TEXT;

-- AlterTable
ALTER TABLE "booking_rooms" ADD COLUMN "hotel_id" UUID,
ADD COLUMN "room_type_name_snapshot" TEXT,
ADD COLUMN "room_type_slug_snapshot" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "currency" TEXT,
ADD COLUMN "hotel_id" UUID,
ADD COLUMN "organization_id" UUID,
ADD COLUMN "terms_snapshot" JSONB;

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN "location_precision" "LocationPrecision" NOT NULL DEFAULT 'NONE',
ADD COLUMN "location_verification" "LocationVerification" NOT NULL DEFAULT 'NONE',
ADD COLUMN "organization_id" UUID,
ADD COLUMN "publication_status" "PropertyPublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "verified_at" TIMESTAMPTZ,
ADD COLUMN "verified_by_user_id" UUID;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "hotel_id" UUID,
ADD COLUMN "organization_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "hotel_id" UUID,
ADD COLUMN "organization_id" UUID;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN "hotel_id" UUID;

-- AlterTable
ALTER TABLE "room_nights" ADD COLUMN "hotel_id" UUID;

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN "organization_id" UUID;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "hotel_id" UUID;

-- AlterTable
ALTER TABLE "site_content" ADD COLUMN "hotel_id" UUID,
ADD COLUMN "organization_id" UUID,
ADD COLUMN "scope" "RecordScope" NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole";

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PROVISIONING',
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Santo is the first tenant. Existing hotels remain publicly visible as they
-- were before this additive migration; listing verification remains unverified.
INSERT INTO "organizations" ("id", "name", "slug", "status", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 'Santo Hotel', 'santo-hotel', 'ACTIVE', CURRENT_TIMESTAMP);

UPDATE "hotels"
SET "organization_id" = '00000000-0000-4000-8000-000000000001',
    "publication_status" = 'PUBLISHED'
WHERE "organization_id" IS NULL;

ALTER TABLE "hotels" ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invited_by_user_id" UUID,
    "invited_at" TIMESTAMPTZ,
    "activated_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_member_hotels" (
    "member_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,

    CONSTRAINT "organization_member_hotels_pkey" PRIMARY KEY ("member_id","hotel_id")
);

-- CreateTable
CREATE TABLE "listing_reviews" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "from_status" "PropertyPublicationStatus" NOT NULL,
    "to_status" "PropertyPublicationStatus" NOT NULL,
    "decision_reason" TEXT,
    "reviewer_user_id" UUID,
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_slug_redirects" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "from_slug" TEXT NOT NULL,
    "hotel_id" UUID NOT NULL,
    "target_slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_user_id_status_idx" ON "organization_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_member_hotels_hotel_id_idx" ON "organization_member_hotels"("hotel_id");

-- CreateIndex
CREATE INDEX "listing_reviews_hotel_id_decided_at_idx" ON "listing_reviews"("hotel_id", "decided_at");

-- CreateIndex
CREATE INDEX "public_slug_redirects_hotel_id_idx" ON "public_slug_redirects"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_slug_redirects_entity_type_from_slug_key" ON "public_slug_redirects"("entity_type", "from_slug");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_hotel_id_created_at_idx" ON "audit_logs"("organization_id", "hotel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_id_hotel_id_key" ON "bookings"("id", "hotel_id");

-- CreateIndex
CREATE INDEX "hotels_organization_id_idx" ON "hotels"("organization_id");

-- CreateIndex
CREATE INDEX "hotels_publication_status_id_idx" ON "hotels"("publication_status", "id");

-- CreateIndex
CREATE INDEX "room_nights_hotel_id_night_idx" ON "room_nights"("hotel_id", "night");

-- CreateIndex
CREATE INDEX "room_types_hotel_id_status_idx" ON "room_types"("hotel_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_id_hotel_id_key" ON "room_types"("id", "hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_hotel_id_key" ON "rooms"("id", "hotel_id");

-- CreateIndex
CREATE SEQUENCE "booking_reference_seq" MINVALUE 1 MAXVALUE 999999 CYCLE;

SELECT setval(
    '"booking_reference_seq"',
    GREATEST(
        COALESCE(
            MAX(CAST(RIGHT("booking_reference", 6) AS INTEGER)),
            0
        ) + 1,
        1
    ),
    false
)
FROM "bookings"
WHERE "booking_reference" ~ '^SH-[0-9]{4}-[0-9]{6}$';

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member_hotels" ADD CONSTRAINT "organization_member_hotels_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member_hotels" ADD CONSTRAINT "organization_member_hotels_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_slug_redirects" ADD CONSTRAINT "public_slug_redirects_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_nights" ADD CONSTRAINT "room_nights_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
