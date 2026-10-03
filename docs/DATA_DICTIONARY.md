# Santo Hotel — Data Dictionary (P2)

Database: PostgreSQL · Schema: [`prisma/schema.prisma`](../prisma/schema.prisma) ·
ERD: [`docs/ERD.md`](ERD.md)

Conventions: UUID primary keys, `snake_case` tables/columns (mapped in Prisma),
`TIMESTAMPTZ` timestamps, `DECIMAL(10,2)` for money, controlled enums for statuses.
Open business values (currency, taxes, policies) are marked **pending** and tracked in
[`docs/OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).

## Enums

| Enum | Values |
| ---- | ------ |
| `UserRole` | ADMIN, STAFF |
| `RecordStatus` | ACTIVE, INACTIVE |
| `RoomStatus` | AVAILABLE, RESERVED, OCCUPIED, CLEANING, MAINTENANCE, OUT_OF_SERVICE |
| `BookingStatus` | PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW |
| `PaymentStatus` | PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED |
| `PromotionType` | PERCENTAGE, FIXED_AMOUNT |
| `NotificationChannel` | EMAIL, SMS, WHATSAPP |
| `NotificationStatus` | PENDING, SENT, FAILED |

## hotels

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| name | text | yes | |
| slug | text | yes | unique |
| description | text | no | |
| phone / email | text | no | |
| address_line1 / address_line2 / city / postcode / country | text | no | |
| timezone | text | yes | default `Asia/Kuala_Lumpur` |
| currency | text | yes | default `MYR` — **pending Q1** |
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
| is_active | boolean | yes | default true |
| last_login_at | timestamptz | no | |
| created_at / updated_at | timestamptz | yes | |

## guests

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| first_name / last_name | text | yes | |
| email | text | no | indexed (not unique — shared/walk-in guests) |
| phone | text | no | |
| id_type / id_number | text | no | requirement **pending Q16** |
| created_at / updated_at | timestamptz | yes | |

## room_types

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| hotel_id | uuid | yes | FK → hotels, RESTRICT |
| name | text | yes | unique |
| slug | text | yes | unique |
| description | text | no | |
| max_adults | int | yes | CHECK ≥ 1; children counting **pending Q15** |
| max_children | int | yes | default 0, CHECK ≥ 0 |
| base_price | decimal(10,2) | yes | CHECK ≥ 0 (via migration) |
| status | RecordStatus | yes | default ACTIVE |
| created_at / updated_at | timestamptz | yes | |

Indexes: `hotel_id`.

## rooms

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| room_type_id | uuid | yes | FK → room_types, RESTRICT |
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
| currency | text | yes | default MYR — **pending Q1** |
| start_date / end_date | date | yes | CHECK end ≥ start |
| status | RecordStatus | yes | default ACTIVE |
| created_at / updated_at | timestamptz | yes | |

Indexes: `room_type_id`, `(start_date, end_date)`.

## bookings

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | internal PK |
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

Indexes: `guest_id`, `check_in`, `check_out`, `booking_status`.

## booking_rooms

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| booking_id | uuid | yes | FK CASCADE; unique with room_id |
| room_id | uuid | yes | FK → rooms, RESTRICT |
| nightly_rate | decimal(10,2) | yes | **historical snapshot** — never updated when rates change |
| nights | int | yes | CHECK ≥ 1 |
| room_total | decimal(10,2) | yes | **historical snapshot**, CHECK ≥ 0 |
| created_at | timestamptz | yes | |

Indexes: unique `(booking_id, room_id)` (covers booking lookups), `room_id` (availability).

## payments

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
| booking_id | uuid | yes | FK RESTRICT (payments are auditable) |
| provider | text | yes | gateway name — **pending Q4** |
| provider_reference | text | no | unique; gateway transaction id |
| amount | decimal(10,2) | yes | CHECK ≥ 0 |
| currency | text | yes | default MYR |
| status | PaymentStatus | yes | default PENDING |
| refunded_amount | decimal(10,2) | yes | default 0, CHECK `0 ≤ refunded ≤ amount` |
| paid_at / refunded_at | timestamptz | no | |
| created_at / updated_at | timestamptz | yes | |

No raw card data is ever stored (P2 §16).

## promotions

| Column | Type | Required | Notes |
| ------ | ---- | -------- | ----- |
| id | uuid | yes | PK |
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
| user_id | uuid | no | FK SET NULL |
| action | text | yes | e.g. `room_rate.updated` |
| entity_type / entity_id | text | yes | affected record |
| old_values / new_values | json | no | before/after snapshots |
| created_at | timestamptz | yes | |

Indexes: `user_id`, `(entity_type, entity_id)`, `created_at`.

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

Rebuild from scratch: `npm run db:reset` → migrations + seed.
Integrity evidence: `npm run db:integrity` (11 checks).
