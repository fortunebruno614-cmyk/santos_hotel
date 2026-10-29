-- Public room map view (MR-07): verified hotel coordinates. Both columns stay
-- NULL until an authorized operator records a verified location — the public
-- map renders an explicit "Map location unavailable" state rather than a
-- guessed pin.
ALTER TABLE "hotels"
  ADD COLUMN "latitude" DECIMAL(9,6),
  ADD COLUMN "longitude" DECIMAL(10,6);

-- Business-rule checks (Prisma does not model CHECK constraints; kept in sync
-- with 20261003040457_add_check_constraints).
ALTER TABLE "hotels"
  ADD CONSTRAINT "hotels_coordinates_pair_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
  ),
  ADD CONSTRAINT "hotels_latitude_range_check" CHECK (
    "latitude" >= -90 AND "latitude" <= 90
  ),
  ADD CONSTRAINT "hotels_longitude_range_check" CHECK (
    "longitude" >= -180 AND "longitude" <= 180
  );
