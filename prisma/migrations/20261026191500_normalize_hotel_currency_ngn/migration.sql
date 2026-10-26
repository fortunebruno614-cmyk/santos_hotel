-- The previous currency migration changed column defaults but did not update
-- existing hotel rows. Normalize the legacy hotel currency without rewriting
-- historical booking or payment currencies and amounts.
UPDATE "hotels"
SET "currency" = 'NGN'
WHERE upper("currency") = 'MYR';
