-- P5 open question #1 is answered: Santo Hotel prices and bills in Nigerian
-- Naira. This changes only the *default* for new rows — the data itself is
-- converted once per environment (existing dev data was rescaled in place).
--
-- Guests may view the site in US Dollars too; that preference lives in the
-- `santo_currency` cookie (@/lib/currency) and is display-only.

ALTER TABLE "hotels" ALTER COLUMN "currency" SET DEFAULT 'NGN';
ALTER TABLE "rates" ALTER COLUMN "currency" SET DEFAULT 'NGN';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'NGN';
