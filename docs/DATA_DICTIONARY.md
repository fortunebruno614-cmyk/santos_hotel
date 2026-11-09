# Santo Hotel — Data Dictionary

Database: PostgreSQL · Schema: [`prisma/schema.prisma`](../prisma/schema.prisma) ·
ERD: [`docs/ERD.md`](ERD.md)

Conventions: UUID primary keys, `snake_case` tables/columns (mapped in Prisma),
`TIMESTAMPTZ` timestamps, `DECIMAL(10,2)` for money, controlled enums for statuses.
Open business values (currency, taxes, policies) are marked **pending** and tracked in
[`docs/OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).

## Enums

| Enum | Values |
| ---- | ------ |
| `UserRole` | ADMIN, STAFF, GUEST |
| `RecordStatus` | ACTIVE, INACTIVE |
| `RoomStatus` | AVAILABLE, RESERVED, OCCUPIED, CLEANING, MAINTENANCE, OUT_OF_SERVICE |
| `BookingStatus` | PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW |
| `PaymentStatus` | PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED |
| `PromotionType` | PERCENTAGE, FIXED_AMOUNT |
| `NotificationChannel` | EMAIL, SMS, WHATSAPP |
| `NotificationStatus` | PENDING, SENT, FAILED |
| `OrganizationStatus` | PROVISIONING, ACTIVE, SUSPENDED, CLOSED |
| `OrganizationRole` | OWNER, MANAGER, STAFF |
| `MemberStatus` | INVITED, ACTIVE, REVOKED |
| `PlatformRole` | SUPPORT, OPERATIONS, ADMIN |
| `PropertyPublicationStatus` | DRAFT, SUBMITTED, UNDER_REVIEW, PUBLISHED, PAUSED, SUSPENDED, ARCHIVED |
| `VerificationStatus` | UNVERIFIED, PENDING, VERIFIED, REJECTED |
| `LocationVerification` | NONE, PLATFORM_VERIFIED |
| `LocationPrecision` | NONE, APPROXIMATE, NEIGHBORHOOD, EXACT |
| `RecordScope` | PLATFORM, TENANT |

## organizations

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| name | text | yes | |
| slug | text | yes | unique |
| status | OrganizationStatus | yes | default PROVISIONING |
| email / phone / country | text | no | organization contact |
| created_at / updated_at | timestamptz | yes | |

## organization_members

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| organization_id / user_id | uuid | yes | FKs; unique together |
| role | OrganizationRole | yes | tenant role |
| status | MemberStatus | yes | default ACTIVE |
| invited_by_user_id | uuid | no | inviter attribution |
| invited_at / activated_at / revoked_at | timestamptz | no | membership lifecycle |
| created_at / updated_at | timestamptz | yes | |

Index: `(user_id, status)`.

## organization_member_hotels

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| member_id | uuid | yes | PK part, FK CASCADE |
| hotel_id | uuid | yes | PK part, FK CASCADE |

## hotels

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| organization_id | uuid | yes | FK → organizations, RESTRICT; existing hotels are assigned to Santo |
| publication_status | PropertyPublicationStatus | yes | default DRAFT; existing public hotel is migrated as PUBLISHED |
| verification_status | VerificationStatus | yes | default UNVERIFIED; migration does not imply verification |
| location_verification / location_precision | enum | yes | defaults NONE; map pin requires later verification workflow |
| verified_at / verified_by_user_id | timestamptz / uuid | no | verification attribution |
| name | text | yes | |
| slug | text | yes | unique |
| description | text | no | |
| phone / email | text | no | |
| address_line1 / address_line2 / city / postcode / country | text | no | |
| latitude / longitude | decimal(9,6) / decimal(10,6) | no | verified map coordinates (MR-07); both set or both NULL (`hotels_coordinates_pair_check`), range-checked (-90..90 / -180..180); set only by an authorized admin — the public map shows "Map location unavailable" while NULL |
| timezone | text | yes | default `Asia/Kuala_Lumpur` |
| currency | text | yes | default `NGN`; historical booking currency is added separately |
| created_at / updated_at | timestamptz | yes | |

## users

Authenticated staff/admin accounts (guest login is a P3 decision, Q13).

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| name | text | yes | |
| email | text | yes | unique |
| password_hash | text | yes | never store plaintext |
| role | UserRole | yes | default STAFF |
| platform_role | PlatformRole | no | marketplace governance role; never inferred from `role` |
| is_active | boolean | yes | default true |
| last_login_at | timestamptz | no | |
| created_at / updated_at | timestamptz | yes | |

## guests

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| first_name / last_name | text | yes | |
| email | text | no | unique index (one account per email) |
| phone | text | no | |
| id_type / id_number | text | no | requirement **pending Q16** |
| password_hash | text | no | argon2/bcrypt hash; null for Google-only accounts |
| firebase_uid | text | no | unique; Firebase Auth uid for Google sign-in |
| avatar_url | text | no | provider profile photo |
| auth_provider | text | no | `google` when linked through Firebase |
| is_active | boolean | yes | default true; false blocks sign-in |
| last_login_at | timestamptz | no | updated on password or Google sign-in |
| created_at / updated_at | timestamptz | yes | |

## room_types

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id | uuid | yes | FK → hotels, RESTRICT |
| organization_id | uuid | no | FK → organizations; nullable until reconciliation |
| name | text | yes | unique |
| slug | text | yes | unique |
| description | text | no | |
| max_adults | int | yes | CHECK ≥ 1; children counting **pending Q15** |
| max_children | int | yes | default 0, CHECK ≥ 0 |
| base_price | decimal(10,2) | yes | CHECK ≥ 0 (via migration) |
| status | RecordStatus | yes | default ACTIVE |
| created_at / updated_at | timestamptz | yes | |

Indexes: `hotel_id`, `(hotel_id, status)`, unique `(id, hotel_id)`.

## rooms

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| room_type_id | uuid | yes | FK → room_types, RESTRICT |
| hotel_id | uuid | no | FK → hotels; nullable until reconciliation |
| room_number | text | yes | unique |
| floor | int | no | |
| status | RoomStatus | yes | default AVAILABLE |
| notes | text | no | operational notes |
| created_at / updated_at | timestamptz | yes | |

Indexes: `room_type_id`, `status`.

## amenities / room_type_amenities

| Table | Column | Type | Required | Notes |
| ----- | ------ | ---- | -------- | ----- |
| amenities | id | uuid | yes | PK |
| amenities | scope | RecordScope | yes | default PLATFORM |
| amenities | organization_id | uuid | no | FK → organizations; nullable for platform scope |
| amenities | name | text | yes | unique |
| amenities | description | text | no | |
| room_type_amenities | room_type_id | uuid | yes | PK part, FK CASCADE |
| room_type_amenities | amenity_id | uuid | yes | PK part, FK CASCADE |

Amenities are never stored as comma-separated text (P2 §13).

## room_images

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| room_type_id | uuid | yes | FK CASCADE |
| url | text | yes | media path (see DB_AND_STORAGE.md) |
| alt_text | text | no | |
| sort_order | int | yes | default 0 |
| created_at | timestamptz | yes | |

Indexes: `room_type_id`.

## rates

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| room_type_id | uuid | yes | FK CASCADE |
| name | text | yes | e.g. "Standard 2026" |
| amount | decimal(10,2) | yes | CHECK ≥ 0 |
| currency | text | yes | default NGN; currency policy remains subject to Q1 |
| start_date / end_date | date | yes | CHECK end ≥ start |
| status | RecordStatus | yes | default ACTIVE |
| created_at / updated_at | timestamptz | yes | |

Indexes: `room_type_id`, `(start_date, end_date)`.

## bookings

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | internal PK |
| hotel_id | uuid | no | FK → hotels; nullable until reconciliation |
| organization_id | uuid | no | FK → organizations; nullable until reconciliation |
| currency | text | no | historical booking currency; use one recorded payment currency when present, otherwise the hotel's current currency |
| terms_snapshot | json | no | migration-time copy of the hotel's current terms; not represented as the original booking-time terms |
| booking_reference | text | yes | unique, customer-facing (`SH-2026-000123`) |
| guest_id | uuid | yes | FK → guests, RESTRICT |
| promotion_id | uuid | no | FK → promotions, SET NULL |
| promotion_code | text | no | snapshot of applied code |
| check_in / check_out | date | yes | CHECK `check_out > check_in` |
| adults | int | yes | default 1, CHECK ≥ 1 |
| children | int | yes | default 0, CHECK ≥ 0 |
| subtotal / taxes / fees / discount / total | decimal(10,2) | yes | default 0, CHECK ≥ 0; taxes/fees **pending Q2, Q3** |
| booking_status | BookingStatus | yes | default PENDING |
| payment_status | PaymentStatus | yes | default PENDING — independent of booking status (**pending Q11**) |
| notes | text | no | |
| created_by_user_id | uuid | no | FK → users, SET NULL (manual staff bookings) |
| created_at / updated_at | timestamptz | yes | |

Indexes: `guest_id`, `check_in`, `check_out`, `booking_status`. Cancellation also
fires trigger `bookings_release_room_nights` (deletes the booking's `room_nights` —
see below).

## booking_rooms

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id | uuid | no | FK → hotels; nullable until reconciliation |
| room_type_name_snapshot / room_type_slug_snapshot | text | no | historical listing identity |
| booking_id | uuid | yes | FK CASCADE; unique with room_id |
| room_id | uuid | yes | FK → rooms, RESTRICT |
| nightly_rate | decimal(10,2) | yes | **historical snapshot** — never updated when rates change |
| nights | int | yes | CHECK ≥ 1 |
| room_total | decimal(10,2) | yes | **historical snapshot**, CHECK ≥ 0 |
| created_at | timestamptz | yes | |

Indexes: unique `(booking_id, room_id)` (covers booking lookups), `room_id` (availability).

## room_nights

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| room_id | uuid | yes | FK → rooms, RESTRICT — **composite PK part 1** |
| hotel_id | uuid | no | FK → hotels; nullable until reconciliation |
| night | date | yes | calendar night the room is held (UTC midnight) — **composite PK part 2** |
| booking_id | uuid | yes | FK → bookings, CASCADE |
| created_at | timestamptz | yes | |

`PRIMARY KEY (room_id, night)` is **the double-booking guard (P4)**: the booking
transaction inserts one row per held night, so a second allocation of the same night
fails with `P2002` no matter which code path attempted it. Nights are half-open
`[check_in, check_out)` when `ALLOW_SAME_DAY_TURNOVER=true` (default), matching
`intervalsOverlap` in `src/server/availability/overlap.ts`. Rows are removed by:

- trigger `bookings_release_room_nights` when a booking becomes `CANCELLED`;
- `releaseExpiredHolds()` on the next allocation, for unpaid `PENDING` bookings older
  than `PENDING_HOLD_MINUTES` (never for `PAID`).

Indexes: `booking_id`.

## payments

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id / organization_id | uuid | no | nullable ownership attribution |
| booking_id | uuid | yes | FK RESTRICT (payments are auditable) |
| provider | text | yes | gateway name — **pending Q4** |
| provider_reference | text | no | unique; gateway transaction id |
| amount | decimal(10,2) | yes | CHECK ≥ 0 |
| currency | text | yes | default NGN |
| status | PaymentStatus | yes | default PENDING |
| refunded_amount | decimal(10,2) | yes | default 0, CHECK `0 ≤ refunded ≤ amount` |
| paid_at / refunded_at | timestamptz | no | |
| created_at / updated_at | timestamptz | yes | |

No raw card data is ever stored (P2 §16).

## promotions

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id | uuid | no | FK → hotels; nullable until reconciliation |
| code | text | yes | unique |
| type | PromotionType | yes | |
| value | decimal(10,2) | yes | CHECK > 0 (percent or amount) |
| start_at / end_at | timestamptz | yes | CHECK `end_at > start_at` |
| max_uses | int | no | CHECK > 0 when set |
| status | RecordStatus | yes | default ACTIVE |
| created_at / updated_at | timestamptz | yes | |

Indexes: `status`. Applied discounts are snapshotted on the booking.

## notifications

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id / organization_id | uuid | no | nullable ownership attribution |
| booking_id | uuid | no | FK SET NULL |
| channel | NotificationChannel | yes | |
| recipient | text | yes | email/phone snapshot |
| subject / body | text | yes (body) | |
| status | NotificationStatus | yes | default PENDING |
| error | text | no | failure reason |
| sent_at | timestamptz | no | |
| created_at | timestamptz | yes | |

Indexes: `booking_id`, `status`.

## audit_logs

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| organization_id / hotel_id | uuid | no | nullable tenant attribution |
| user_id | uuid | no | FK SET NULL |
| actor_type / actor_guest_id | text / uuid | no | actor attribution |
| ip_address / purpose / outcome | text | no | request context and result |
| action | text | yes | e.g. `room_rate.updated` |
| entity_type / entity_id | text | yes | affected record |
| old_values / new_values | json | no | before/after snapshots |
| created_at | timestamptz | yes | |

Indexes: `user_id`, `(entity_type, entity_id)`, `created_at`,
`(organization_id, hotel_id, created_at)`.

## booking reference sequence

`booking_reference_seq` reserves the numeric portion of `SH-YYYY-NNNNNN`
atomically. The migration initializes it above existing six-digit reference
numbers. The existing booking-reference unique constraint remains the collision
guard.

## site_content

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| key | text | yes | stable content slot PK |
| scope | RecordScope | yes | default PLATFORM |
| organization_id / hotel_id | uuid | no | optional tenant/property scope |
| title / body | text | no / yes | editable site content |
| updated_by_user_id | uuid | no | editor attribution |
| created_at / updated_at | timestamptz | yes | |

## listing_reviews / public_slug_redirects

`listing_reviews` records the hotel, prior/next publication status, decision reason,
reviewer, and timestamp. `public_slug_redirects` preserves the prior slug and target
slug, scoped to a hotel; the pair `(entity_type, from_slug)` is unique.

## Migrations

| Migration | Contents |
| --------- | -------- |
| `20261003035450_init_hotels` | Hotel (superseded by 002 rename) |
| `20261003040340_users_guests` | `hotels` (snake_case rename), users, guests |
| `20261003040402_rooms_amenities` | room_types, rooms, amenities, room_type_amenities, room_images |
| `20261003040415_rates_promotions` | rates, promotions |
| `20261003040431_bookings_booking_rooms` | bookings, booking_rooms |
| `20261003040449_payments_notifications_audit` | payments, notifications, audit_logs |
| `20261003040457_add_check_constraints` | raw-SQL CHECK constraints (13) |
| `20261028090000_hotel_map_coordinates` | `hotels.latitude` / `hotels.longitude` + coordinate pair/range CHECKs (public room map) |
| `20261029120000_multi_tenant_foundation` | Organization/membership/listing models, additive owner columns, booking reference sequence, and initial Santo organization backfill |

Rebuild from scratch: `npm run db:reset` → migrations + seed.
Integrity evidence: `npm run db:integrity` (15 checks).
