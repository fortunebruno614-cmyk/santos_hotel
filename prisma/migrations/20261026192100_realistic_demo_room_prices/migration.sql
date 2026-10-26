-- Restore the demo room prices to their NGN values. These legacy values were
-- left at their original MYR-era numbers when only column defaults changed.
UPDATE "room_types"
SET "base_price" = CASE "slug"
    WHEN 'deluxe-king' THEN 144000
    WHEN 'executive-suite' THEN 272000
    WHEN 'family-room' THEN 208000
END
WHERE ("slug", "base_price") IN (
    ('deluxe-king', 450),
    ('executive-suite', 850),
    ('family-room', 650)
);

UPDATE "rates" AS rate
SET "amount" = CASE room_type."slug"
    WHEN 'deluxe-king' THEN 144000
    WHEN 'executive-suite' THEN 272000
    WHEN 'family-room' THEN 208000
END,
"currency" = 'NGN'
FROM "room_types" AS room_type
WHERE rate."room_type_id" = room_type."id"
  AND rate."name" = 'Standard 2026'
  AND rate."currency" = 'MYR'
  AND (room_type."slug", rate."amount") IN (
      ('deluxe-king', 450),
      ('executive-suite', 850),
      ('family-room', 650)
  );
