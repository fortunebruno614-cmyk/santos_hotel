-- Firebase Authentication (Google) support for guest accounts.
-- Existing password guests keep password_hash; social guests link by firebase_uid.
ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT,
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "auth_provider" TEXT;

-- Postgres allows multiple NULLs in a unique index, so password-only guests
-- are unaffected while a Firebase identity can only map to one guest.
CREATE UNIQUE INDEX IF NOT EXISTS "guests_firebase_uid_key" ON "guests"("firebase_uid");
