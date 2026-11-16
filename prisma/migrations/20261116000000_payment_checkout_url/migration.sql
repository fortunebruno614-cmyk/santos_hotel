-- Reuse the hosted checkout URL returned by the gateway on page refresh.
-- Without it, a pending Paystack intent would need a second
-- /transaction/initialize call, and Paystack rejects a duplicate reference.
ALTER TABLE "payments" ADD COLUMN "checkout_url" TEXT;
