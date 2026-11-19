-- Self-service hotel onboarding: business verification (KYC) evidence.
-- The document is stored inline so a local/dev deployment needs no external
-- object storage; the guarded platform API streams it to reviewers.

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('CAC_CERTIFICATE', 'BUSINESS_LICENSE', 'TAX_CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "organization_kyc" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "registration_number" TEXT,
    "document_type" "KycDocumentType" NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_mime_type" TEXT NOT NULL,
    "document_size" INTEGER NOT NULL,
    "document_data" BYTEA NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by_id" UUID,

    CONSTRAINT "organization_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_kyc_organization_id_key" ON "organization_kyc"("organization_id");

-- CreateIndex
CREATE INDEX "organization_kyc_status_submitted_at_idx" ON "organization_kyc"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "organization_kyc" ADD CONSTRAINT "organization_kyc_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_kyc" ADD CONSTRAINT "organization_kyc_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
