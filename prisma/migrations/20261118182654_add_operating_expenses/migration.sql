-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARIES', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'SUPPLIES', 'TAXES', 'OTHER');

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "hotel_id" UUID,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "incurred_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_hotel_id_incurred_at_idx" ON "expenses"("hotel_id", "incurred_at");

-- CreateIndex
CREATE INDEX "expenses_organization_id_incurred_at_idx" ON "expenses"("organization_id", "incurred_at");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
