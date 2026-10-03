# Santo Hotel — Entity Relationship Diagram (P2)

```mermaid
erDiagram
  HOTELS ||--o{ ROOM_TYPES : offers
  ROOM_TYPES ||--o{ ROOMS : "has physical"
  ROOM_TYPES ||--o{ RATES : "priced by"
  ROOM_TYPES ||--o{ ROOM_IMAGES : "shown by"
  ROOM_TYPES ||--o{ ROOM_TYPE_AMENITIES : equipped
  AMENITIES ||--o{ ROOM_TYPE_AMENITIES : "used in"
  GUESTS ||--o{ BOOKINGS : makes
  USERS ||--o{ BOOKINGS : "created by (staff)"
  USERS ||--o{ AUDIT_LOGS : performs
  PROMOTIONS ||--o{ BOOKINGS : discounts
  BOOKINGS ||--o{ BOOKING_ROOMS : allocates
  ROOMS ||--o{ BOOKING_ROOMS : "allocated as"
  BOOKINGS ||--o{ PAYMENTS : "paid by"
  BOOKINGS ||--o{ NOTIFICATIONS : triggers

  HOTELS {
    uuid id PK
    text name
    text slug UK
    text timezone
    text currency
  }
  USERS {
    uuid id PK
    text email UK
    text password_hash
    enum role "ADMIN, STAFF"
    bool is_active
  }
  GUESTS {
    uuid id PK
    text first_name
    text last_name
    text email
    text phone
    text id_type
    text id_number
  }
  ROOM_TYPES {
    uuid id PK
    uuid hotel_id FK
    text name UK
    text slug UK
    int max_adults
    int max_children
    decimal base_price
    enum status "ACTIVE, INACTIVE"
  }
  ROOMS {
    uuid id PK
    uuid room_type_id FK
    text room_number UK
    int floor
    enum status "RoomStatus"
  }
  AMENITIES {
    uuid id PK
    text name UK
    text description
  }
  ROOM_TYPE_AMENITIES {
    uuid room_type_id PK_FK
    uuid amenity_id PK_FK
  }
  ROOM_IMAGES {
    uuid id PK
    uuid room_type_id FK
    text url
    int sort_order
  }
  RATES {
    uuid id PK
    uuid room_type_id FK
    text name
    decimal amount
    text currency
    date start_date
    date end_date
    enum status "ACTIVE, INACTIVE"
  }
  BOOKINGS {
    uuid id PK
    text booking_reference UK
    uuid guest_id FK
    uuid promotion_id FK "nullable"
    text promotion_code "snapshot"
    date check_in
    date check_out
    int adults
    int children
    decimal subtotal
    decimal taxes
    decimal fees
    decimal discount
    decimal total
    enum booking_status "BookingStatus"
    enum payment_status "PaymentStatus"
    uuid created_by_user_id FK "nullable"
  }
  BOOKING_ROOMS {
    uuid id PK
    uuid booking_id FK
    uuid room_id FK
    decimal nightly_rate "historical snapshot"
    int nights
    decimal room_total "historical snapshot"
  }
  PAYMENTS {
    uuid id PK
    uuid booking_id FK
    text provider
    text provider_reference UK
    decimal amount
    text currency
    enum status "PaymentStatus"
    decimal refunded_amount
    timestamptz paid_at
    timestamptz refunded_at
  }
  PROMOTIONS {
    uuid id PK
    text code UK
    enum type "PERCENTAGE, FIXED_AMOUNT"
    decimal value
    timestamptz start_at
    timestamptz end_at
    int max_uses
    enum status "ACTIVE, INACTIVE"
  }
  NOTIFICATIONS {
    uuid id PK
    uuid booking_id FK "nullable"
    enum channel "EMAIL, SMS, WHATSAPP"
    text recipient
    text subject
    text body
    enum status "PENDING, SENT, FAILED"
    timestamptz sent_at
  }
  AUDIT_LOGS {
    uuid id PK
    uuid user_id FK "nullable"
    text action
    text entity_type
    text entity_id
    json old_values
    json new_values
    timestamptz created_at
  }
```

## Cardinality summary

| Relationship | Type | Notes |
| ------------ | ---- | ----- |
| Hotel → Room Types | 1—* | single-tenant, but modeled |
| Room Type → Room | 1—* | one category, many physical rooms |
| Room Type → Rate | 1—* | date-bounded pricing |
| Room Type ↔ Amenity | *—* | via `room_type_amenities` |
| Room Type → Room Image | 1—* | category photography |
| Guest → Booking | 1—* | guest history |
| User → Booking | 1—* | staff-created/manual bookings (nullable) |
| Promotion → Booking | 1—* | nullable; applied values snapshotted |
| Booking → Booking Room | 1—* | one reservation, many rooms |
| Room → Booking Room | 1—* | same room across many bookings |
| Booking → Payment | 1—* | one booking, many transactions/refunds |
| Booking → Notification | 1—* | confirmations, reminders |
| User → Audit Log | 1—* | accountability trail |

## Key design decisions

- **Room type vs physical room** — shared attributes on `room_types`, inventory on `rooms`.
- **Historical snapshots** — `booking_rooms.nightly_rate`/`room_total`, booking totals and
  `promotion_code` preserve what was actually charged; current rates can change freely.
- **Availability-friendly indexes** — `rooms(status, room_type_id)`,
  `booking_rooms(room_id)`, `bookings(check_in, check_out, booking_status)` support the
  P4 overlap query. The DB-level exclusion constraint is added in P4 after the
  check-in/out turnover policy is confirmed (`docs/OPEN_QUESTIONS.md` #7, #8).
- **Deletion behavior** — guests/bookings/rooms are `RESTRICT` (audit-safe); booking
  rooms cascade with their booking; user references on bookings/audits become `NULL`.
- **No card data** — payments store provider references only.
