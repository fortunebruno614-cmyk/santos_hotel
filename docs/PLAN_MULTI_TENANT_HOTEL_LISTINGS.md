# Implementation Plan: Multi-Tenant Hotel Listings

**Product:** Santo Hotel marketplace and property-management platform
**Derived from:** [MRD_MULTI_TENANT_HOTEL_LISTINGS.md](./MRD_MULTI_TENANT_HOTEL_LISTINGS.md)
**Review basis:** [MRD_MULTI_TENANT_HOTEL_LISTINGS_REVIEW.md](./MRD_MULTI_TENANT_HOTEL_LISTINGS_REVIEW.md)
**Status:** Draft for engineering and business sign-off
**Owner:** Santo Hotel product owner / engineering lead
**Date:** 2026-10-29
**Related:** [Development plan](./DEVELOPMENT_PLAN.md), [ERD](./ERD.md), [Data dictionary](./DATA_DICTIONARY.md), [Open questions](./OPEN_QUESTIONS.md)

---

## 1. Purpose and relationship to the MRD

The MRD defines *what* a multi-tenant Santo marketplace must guarantee. This plan defines *how* to build it against the current codebase, in what order, and what proves each step is done.

It does not restate the requirements. Where a phase implements a requirement, the requirement ID is cited inline (for example `REQ-023`). Where a business decision is still open, the phase is scoped so it can proceed without that decision, and the dependency is named rather than assumed away.

**Scope of this plan:** Phase 0 through Phase 3 of the MRD release plan (sections 14.0 to 14.3). MRD Phase 4 (commercial scale and integrations) is explicitly excluded and requires separate approval.

### 1.1 What this plan changes versus a naive approach

The MRD warns in section 22 not to treat the current `Hotel` table or the `hotelId` on `RoomType` as sufficient multi-tenancy. Review findings F-01 to F-20 confirm why. The plan therefore has an unusual shape:

- **Ownership context is threaded through existing services, not bolted on.** `loadHotelContext()` (F-02) is the single most dangerous defect in the codebase: 15 call sites across 7 files silently price and policy every booking against the oldest hotel row. It is replaced with an explicit, parameterised resolver in Phase 3, before any second hotel can be created.
- **Isolation is enforced in the database, not only in handlers.** Composite foreign keys make a cross-tenant allocation structurally impossible (Phase 7), so a single missed guard cannot leak inventory.
- **Constraints are tightened last.** Global unique keys are relaxed into tenant-scoped ones only after backfill and reconciliation pass, so the migration is reversible at every step.

---

## 2. Ground rules

These extend the ground rules already recorded in [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) and apply to every phase below.

1. **Deny by default.** An unauthorised request fails closed. A missing tenant context is an error, never a default to "all rows" (MRD business rule 12).
2. **Never accept tenant identity from the client.** Hotel and organization context is always resolved server-side from the resource being touched, never from a URL parameter, request body, header, or email domain (MRD business rule 11).
3. **Expand, migrate, contract.** Every schema change lands additively first. Destructive steps are a separate, later release, gated on reconciliation.
4. **No manual production database edits.** Every data change is a versioned, reviewable migration or a re-runnable script with a dry-run mode.
5. **Historical money is immutable.** A confirmed booking's currency, totals, and terms never change because a property's settings changed (REQ-032, REQ-037).
6. **Santo is a tenant, not a special case.** The first tenant is created by the same migration path a second tenant would use (MRD assumption 2).
7. **Every gate is executable.** A gate is a command that exits non-zero on failure, not a review meeting.
8. **The availability ledger is not to be redesigned.** See F-21: `room_nights`, sorted `FOR UPDATE`, half-open nights, and the cancel trigger are already tenant-safe.

---

## 3. Target tenancy model

### 3.1 Core concepts

| Concept | Model | Notes |
|---|---|---|
| Tenant organization | `Organization` | New. The operator boundary. Owns hotels and memberships. |
| Membership | `OrganizationMember` | New. User-to-organization, with an org role and lifecycle status. |
| Property scope | `OrganizationMemberHotel` | New. Which of the organization's hotels a member may work on. |
| Property / listing | `Hotel` | Existing. Gains `organizationId` and publication/verification state. |
| Platform operator | `User.platformRole` | New nullable column. Distinct from tenant roles (REQ-026). |
| Guest identity | `Guest` | **Unchanged.** Marketplace-wide by design (MRD assumption 5, F-19). |

### 3.2 Ownership invariant

> Every hotel-owned record resolves to exactly one `Hotel`, and every `Hotel` resolves to exactly one active `Organization`. No record may exist without a resolvable owner except platform-level records, which are explicitly typed as such.

Records that resolve through a parent rather than carrying their own `hotelId` are listed explicitly in section 6 so nothing is left to inference.

### 3.3 Role model

Two orthogonal axes, kept separate deliberately:

| Axis | Source | Governs |
|---|---|---|
| **Platform role** | `User.platformRole` (`SUPPORT` / `OPERATIONS` / `ADMIN`) | Santo marketplace governance: review, suspend, break-glass support access. Lives under `/platform`. |
| **Tenant role** | `OrganizationMember.role` (`OWNER` / `MANAGER` / `STAFF`) | Property operations within one organization. Lives under `/admin`. |

A user may hold a platform role and a tenant membership simultaneously, but every action executes under exactly one explicit context. `ADMIN` is not implicitly a platform administrator (REQ-047).

**Permission set** carries forward unchanged from `src/server/auth/roles.ts` - the eleven existing `Permission` values remain the vocabulary. What changes is that each permission is now evaluated as *(context, permission, hotel)* rather than *(role, permission)*.

---

## 4. Target data model

All changes below are **expand-phase** (additive) unless marked otherwise. Column and index names follow the existing snake_case `@map` convention.

### 4.1 New models

```prisma
model Organization {
  id        String             @id @default(uuid()) @db.Uuid
  name      String
  slug      String             @unique
  status    OrganizationStatus @default(PROVISIONING)
  email     String?
  phone     String?
  country   String?
  createdAt DateTime           @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt DateTime           @updatedAt @map("updated_at") @db.Timestamptz()

  hotels    Hotel[]
  members   OrganizationMember[]
  amenities Amenity[]
  content   SiteContent[]

  @@map("organizations")
}

model OrganizationMember {
  id             String         @id @default(uuid()) @db.Uuid
  organizationId String         @map("organization_id") @db.Uuid
  userId         String         @map("user_id") @db.Uuid
  role           OrganizationRole
  status         MemberStatus   @default(ACTIVE)
  invitedById    String?        @map("invited_by_user_id") @db.Uuid
  invitedAt      DateTime?      @map("invited_at") @db.Timestamptz()
  activatedAt    DateTime?      @map("activated_at") @db.Timestamptz()
  revokedAt      DateTime?      @map("revoked_at") @db.Timestamptz()
  createdAt      DateTime       @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime       @updatedAt @map("updated_at") @db.Timestamptz()

  organization Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  hotels       OrganizationMemberHotel[]

  @@unique([organizationId, userId])
  @@index([userId, status])
  @@map("organization_members")
}

/// Property scope. A row here is required for MANAGE_* permissions; the
/// organization OWNER/ADMIN roles implicitly cover every hotel in the org
/// without needing a row per property.
model OrganizationMemberHotel {
  memberId String @map("member_id") @db.Uuid
  hotelId  String @map("hotel_id") @db.Uuid

  member OrganizationMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  hotel  Hotel              @relation(fields: [hotelId], references: [id], onDelete: Cascade)

  @@id([memberId, hotelId])
  @@index([hotelId])
  @@map("organization_member_hotels")
}

/// Attributable public-visibility change (REQ-041, REQ-043).
model ListingReview {
  id             String               @id @default(uuid()) @db.Uuid
  hotelId        String               @map("hotel_id") @db.Uuid
  fromStatus     PropertyPublicationStatus @map("from_status")
  toStatus       PropertyPublicationStatus @map("to_status")
  decisionReason String?              @map("decision_reason")
  reviewerUserId String?              @map("reviewer_user_id") @db.Uuid
  decidedAt      DateTime             @default(now()) @map("decided_at") @db.Timestamptz()

  hotel Hotel @relation(fields: [hotelId], references: [id], onDelete: Cascade)

  @@index([hotelId, decidedAt])
  @@map("listing_reviews")
}

/// Preserves public URLs across renames and the global-to-tenant slug change (F-17, REQ-002).
model PublicSlugRedirect {
  id          String   @id @default(uuid()) @db.Uuid
  entityType  String   @map("entity_type")   // "hotel" | "room_type"
  fromSlug    String   @map("from_slug")
  hotelId     String   @map("hotel_id") @db.Uuid
  targetSlug  String   @map("target_slug")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()

  @@unique([entityType, fromSlug])
  @@index([hotelId])
  @@map("public_slug_redirects")
}
```

### 4.2 Existing model changes

| Model | Change | Reason |
|---|---|---|
| `Hotel` | `+ organizationId` (NOT NULL after backfill), `+ publicationStatus`, `+ verificationStatus`, `+ locationVerification`, `+ locationPrecision`, `+ verifiedAt`, `+ verifiedById` | REQ-014, REQ-015, REQ-018, Journey 7 |
| `RoomType` | `+ organizationId` (denormalised, FK-consistent). `name` and `slug` change from global `@unique` to `@@unique([hotelId, name])` / `@@unique([hotelId, slug])` - **enforced in Phase 7 only** | F-04; MRD section 12 requires property-scoped uniqueness |
| `Room` | `+ hotelId` (denormalised), room number changes from global `@unique` to `@@unique([hotelId, roomNumber])` - **Phase 7** | F-04; MRD business rule 3 |
| `Booking` | `+ hotelId` (NOT NULL after backfill), **`+ currency` (NOT NULL)**, `+ termsSnapshot Json`, `+ organizationId` | **F-01, F-05**; REQ-032, REQ-037 |
| `BookingRoom` | `+ hotelId`, `+ roomTypeNameSnapshot`, `+ roomTypeSlugSnapshot` | REQ-032; enables composite FK |
| `RoomNight` | `+ hotelId` (denormalised) | Tenant-scoped availability analytics without a three-way join |
| `Payment` | `+ hotelId`, `+ organizationId` (denormalised) | REQ-034, REQ-038; tenant financial reporting |
| `Notification` | `+ hotelId`, `+ organizationId` (denormalised) | MRD section 12: notification must carry property context |
| `AuditLog` | `+ organizationId`, `+ hotelId`, `+ actorType`, `+ actorGuestId`, `+ ipAddress`, `+ purpose`, `+ outcome` | **F-13**; REQ-026, REQ-043, REQ-044 |
| `Promotion` | `+ hotelId`; code changes from global `@unique` to `@@unique([hotelId, code])` - **Phase 7** | **F-10** |
| `Amenity` | `+ scope` (`PLATFORM`/`TENANT`), `+ organizationId`. Platform rows stay globally unique via partial index; tenant rows unique per organization | MRD business rule 13; **F-11** |
| `SiteContent` | `+ scope`, `+ hotelId`. Platform keys unchanged; tenant keys scoped | MRD assumption 10; **F-12** |
| `Guest` | **No change.** Marketplace-wide identity is intentional | MRD assumption 5; **F-19** |

### 4.3 Cross-tenant integrity at the database layer

This is the design's strongest guarantee and the reason a missed application guard cannot cause a leak. Each parent gains a composite unique key so children can reference the *pair* (record, hotel):

```prisma
model RoomType {
  @@unique([id, hotelId])           // enables the chain below
}
model Room {
  @@unique([id, hotelId])
  @@relation("RoomBelongsToHotel", [roomTypeId, hotelId], references: [id, hotelId])
}
model Booking {
  @@unique([id, hotelId])
}
model BookingRoom {
  @@relation("AllocationBelongsToHotel", [roomId, hotelId], references: [id, hotelId])
  @@relation("BookingBelongsToHotel",    [bookingId, hotelId], references: [id, hotelId])
}
model RoomNight {
  @@relation("NightBelongsToHotel", [roomId, hotelId], references: [id, hotelId])
}
model Payment {
  @@relation("PaymentBelongsToHotel", [bookingId, hotelId], references: [id, hotelId])
}
```

**Effect:** an allocation that points a hotel-A booking at a hotel-B room is rejected by Postgres, not by a handler. This directly satisfies REQ-021, REQ-023 and the edge case "An API request includes a valid record ID belonging to another tenant".

### 4.4 Booking references (F-06)

The `SH-YYYY-NNNNNN` format is preserved unchanged (REQ-046 - existing references must resolve identically). Only the allocator changes, from a `MAX()` scan with application retry to a Postgres sequence:

```sql
CREATE SEQUENCE booking_reference_seq MINVALUE 1 MAXVALUE 999999 CYCLE;
```

Format stays `SH-<YYYY>-<lpad(nextval, 6)>`. Cross-year collisions are impossible because the year differs; within a year the sequence is collision-free, so the retry loop in `createBooking` reduces from a correctness mechanism to a safety net. An operational alert fires at 900,000 to warn before a `CYCLE` reuse.

---

## 5. Authorization design

### 5.1 Session

```ts
export type SessionPayload = {
  kind: "staff" | "guest" | "platform";
  role: AppRole;              // retained for guest principals
  userId?: string;
  guestId?: string;
  email?: string;
  orgId?: string;             // active organization context, staff only
  platformRole?: PlatformRole;
};
```

`isSessionValid()` in `src/server/auth/dal.ts` already re-validates against the database on every request, which is what makes role changes and deactivation take effect immediately. That mechanism is extended, not replaced: for `kind === "staff"` it now also reloads the `OrganizationMember` row for `orgId` and requires `status === ACTIVE`. Revocation therefore takes effect on the next request, satisfying Journey 4.4.

A JWT deliberately carries **no permissions and no hotel list**. It carries only the context selector; every permission decision reads current database state. A seven-day stale token can therefore never outlive a revoked membership.

### 5.2 Enforcement helpers

New module `src/server/auth/tenancy.ts`:

| Function | Contract |
|---|---|
| `requireTenantContext(session, permission)` | Returns the active `OrganizationMember`, or throws. Deny if `status !== ACTIVE`. |
| `assertHotelAccess(member, hotelId, permission)` | Resolves the hotel, asserts it belongs to the member's organization and is in scope. Throws `not_found` (never `forbidden`) for a hotel outside the organization, so existence is not disclosed. |
| `resolveHotelOf(resource)` | Resource-to-hotel resolution helpers (`hotelOfRoom`, `hotelOfBooking`, `hotelOfRoomType`, ...). The only sanctioned way to derive hotel context. |
| `requirePlatform(session, platformPermission)` | Platform-axis guard, distinct permission vocabulary. |

**Rule:** every handler that touches a tenant-owned resource calls `resolveHotelOf` then `assertHotelAccess`. Parameters named `hotelId` in request bodies or query strings are never trusted.

### 5.3 Route structure

| Namespace | Audience | Guard |
|---|---|---|
| `/api/public/**`, `/` , `/hotels/**` | Guests, anonymous | Public; hotel context from published slug, validated server-side |
| `/api/account/**`, `/account` | Guest principals | Guest session + ownership of the specific booking |
| `/api/admin/**`, `/admin/**` | Tenant members | `requireTenantContext` + `assertHotelAccess` per resource |
| `/api/platform/**`, `/platform/**` | Santo operators | `requirePlatform` + mandatory audit with `purpose` |

Existing `/admin` and `/api/admin` paths are preserved as the tenant console, so no rename churn is required and the access-map rules stay legible.

### 5.4 Deny-by-default correction (F-08)

`API_FALLBACK` at `src/config/access-map.ts:103` currently resolves unlisted `/api/**` paths to `{ kind: "authenticated" }`. That is unreachable-safe only while a single tenant exists. It changes to an explicit deny for `/api/admin` and `/api/platform`: any route not registered in `ACCESS_RULES` returns 404 for those namespaces. This makes "forgot to scope the new endpoint" a loud failure rather than a silent cross-tenant read (NFR-002).

---

## 6. Source-to-tenant ownership map

This closes review item 7.4. Every surface in the current codebase, its hotel dependency today, and what it becomes.

### 6.1 Ambient single-hotel resolution - must become explicit

| Site | Today | Becomes |
|---|---|---|
| `src/server/pricing/context.ts` `loadHotelContext()` | `hotel.findFirst({ orderBy: { createdAt: "asc" } })` | `requireHotelContext(hotelId)` - **required** parameter, throws when absent. 15 call sites across 7 files updated: `booking/service.ts` (x5), `public/search.ts` (x3), `pricing/service.ts` (x2), `payments/service.ts` (x2), `console/settings.ts`, `console/guests.ts`, `console/dashboard.ts`. |
| `src/server/public/catalog.ts` `loadHotelProfile()` | first-row lookup | `loadHotelProfile(hotelSlug)` from a published listing |
| `src/server/console/settings.ts` `getSettings()`/`updateSettings()` | first-row lookup | Settings read/written for the active organization's named hotel |
| `src/server/console/catalog.ts` `hotelIdOrThrow()` | first-row lookup | Membership-derived hotel scope |

### 6.2 Unscoped reads - must gain an ownership predicate

| Surface | Today | Becomes |
|---|---|---|
| `loadPublicRoomTypes()` | All active room types | `where: { hotelId, status: ACTIVE }` |
| `loadRoomsInventory()` | All rooms of active types | Scoped by `hotelId` |
| `findAvailability()` | All active room types | Scoped by `hotelId`; rejects room ids outside it |
| `computeQuote()` | Global rates/promotions | Rates and promotions resolved within the hotel |
| `evaluatePromotion()` | Global `code` lookup | `where: { hotelId, code }` (F-10) |
| `console/bookings.ts` `searchBookings()` | Global | `where: { hotelId }` |
| `console/payments.ts` `searchPayments()` | Global | `where: { hotelId }` |
| `console/guests.ts` `searchGuests()` | Global | Guests **reachable through this hotel's bookings** only (REQ-025) |
| `console/dashboard.ts` `getDashboard()` | Global bookings/rooms | Scoped by `hotelId`; timezone from that hotel |
| `console/audit.ts` `searchAudit()` | Global | `where: { organizationId }` unless platform-scoped |
| `console/catalog.ts` `listRooms/listRates/listPromotions/listAmenities` | Global | Scoped by `hotelId`; duplicate checks become per-hotel |
| `console/users.ts` `listUsers`/`countActiveAdmins` | Global | Scoped by `organizationId`; last-admin guard becomes per-organization |

### 6.3 Mutations without ownership verification

| Surface | Gap | Fix |
|---|---|---|
| `booking/service.ts` `updateRoomStatus()` (F-16) | Room addressed by raw id | Resolve hotel via `room.roomType.hotelId`, assert access |
| `/api/admin/guests/[id]` PATCH | `VIEW_GUESTS` permission gates a **write** | Split to `MANAGE_GUESTS` for mutations; scope to guests of this hotel |
| `console/catalog.ts` delete paths | No ownership pre-read | Pre-read, assert, then delete |
| `pricing/service.ts` `computeQuote()` room ids | Rooms loaded by raw ids | Reject any room whose `roomType.hotelId` differs from the request's hotel |

### 6.4 Surfaces that already carry correct context

Recorded so effort is not wasted (F-21):

- `room_nights` primary key `(room_id, night)` and the sorted `FOR UPDATE` lock order in `createPendingBooking`.
- The `release_room_nights_on_cancel` trigger.
- Guest account booking scoping in `/api/account/**` (already filters by `guestId` from session and 404s on non-ownership).
- Payment webhook signature verification (HMAC over the raw body, replay-safe under the payment row lock).
- The booking claim cookie mechanism.

---

## 7. Phases

Estimates assume one engineer familiar with the codebase, working in the existing expand/migrate/contract style. Durations are indicative and exclude the Phase 0 decision latency, which is the dominant schedule risk.

---

### M0 - Decisions, inventory, and fixtures (3-5 days, no production code)

Purpose: remove every decision that would force rework, and build the two-tenant fixture the whole programme is tested against.

- [ ] Resolve the Phase 0 decisions in section 11 with named owners and dates.
- [ ] Publish the ownership map in section 6 as a reviewed artifact (this plan section, plus a per-table appendix in the ERD).
- [ ] Agree quantified targets: tenant count, properties per tenant, active inventory, peak concurrent searches/bookings, p95 latency, support SLA. These give NFR-011 to NFR-014 something to be measured against.
- [ ] Build the two-tenant seed: **Santo Hotel** (existing data) plus **"Aurora Test Hotel"**, a second organization with its own room types, rooms, rates, promotions, guests and bookings, used by every isolation test thereafter.
- [ ] Add `scripts/mt-fixtures.ts` producing that second tenant deterministically.
- [ ] Record the guest-PII field-level policy (before/during/after stay) requested by open question 10.

**Gate:** `npm run mt:fixtures` creates a second tenant and the existing suite still passes. Every decision in section 11 is either resolved or explicitly deferred with its blocking phase named.

---

### M1 - Schema expansion (4-6 days)

Purpose: add every new column, table, and enum additively, with **no behaviour change** and **no constraint tightening**.

- [ ] Add new enums and models from section 4.1 (`Organization`, `OrganizationMember`, `OrganizationMemberHotel`, `ListingReview`, `PublicSlugRedirect`).
- [ ] Add nullable denormalised ownership columns from section 4.2.
- [ ] Add composite unique keys `@@unique([id, hotelId])` on `RoomType`, `Room`, `Booking` (these are additive and break nothing).
- [ ] Create Santo's `Organization` row and set `hotels.organization_id` for the existing hotel.
- [ ] Add the `booking_reference_seq` sequence; switch the allocator in `src/server/booking/reference.ts` while keeping the format identical.
- [ ] Add indexes: `hotels(organization_id)`, `hotels(publication_status, id)`, `room_types(hotel_id, status)`, `organization_members(user_id, status)`, `audit_logs(organization_id, hotel_id, created_at)`, `booking_nights(hotel_id, night)`.
- [ ] Update `prisma/seed.ts` to create an organization alongside the hotel.
- [ ] Verify `npm run db:migrate` is clean from an empty database and from a copy of production.

**Gate:** `npm run typecheck`, `npm run lint`, `npm run test` all green. `npm run db:integrity` and `npm run db:indexes` pass. A production copy migrates without error and the app behaves identically, because no read path changed.

---

### M2 - Santo migration and reconciliation (4-6 days)

Purpose: make Santo a normal first tenant with zero unexplained variance (REQ-046 to REQ-049).

- [ ] `scripts/mt00-preflight.ts` (dry-run, read-only) reporting:
  - Record counts per table, before and expected after.
  - Uniqueness conflicts: emails, room numbers, room-type names and slugs, promotion codes, amenity names, booking references.
  - Orphaned records: rows whose ownership path cannot be resolved.
  - Ambiguous bookings: bookings whose allocations resolve to more than one hotel, or to none. **Halt on any hit** - do not guess (MRD section 15).
  - Timezone/currency inconsistencies (F-18: the schema default pairs `Asia/Kuala_Lumpur` with `NGN`).
- [ ] `scripts/mt01-backfill.ts`, transactional and re-runnable:
  - `Booking.hotel_id` via `booking_rooms -> rooms -> room_types -> hotel_id`.
  - **`Booking.currency`** from `hotels.currency` (F-01).
  - `Booking.terms_snapshot` from the hotel's then-current policy settings.
  - `rooms.hotel_id` from `room_types.hotel_id`.
  - `payments.hotel_id` / `organization_id` via booking.
  - `notifications.hotel_id` via booking.
  - `room_nights.hotel_id` via room.
  - Users to `OrganizationMember` per the reviewed role mapping: `ADMIN -> OWNER`, `STAFF -> STAFF`, and **no platform role granted implicitly** (REQ-047).
- [ ] `scripts/mt02-reconcile.ts` producing a signed report:
  - Counts per table, per property.
  - Financial totals: sum of `total`, `taxes`, `fees`, `discount`, `subtotal` by currency, before vs after - **exact match required**.
  - Booking reference set is identical; every reference still resolves.
  - Every booking has exactly one `hotel_id`; every payment matches its booking's currency.
- [ ] `scripts/mt03-backup.ts` and `scripts/mt04-restore.ts`; run one full restore drill.
- [ ] Freeze/dual-write decision documented with a maintenance window length.

**Gate:** zero unexplained variance in `mt02-reconcile.ts`. Restore drill passes with a measured RTO/RPO. `npm test` green. Santo's end-to-end booking, refund, and staff flows verified manually against the migrated database.

**Rollback:** M1 and M2 are additive. Rollback is redeploying the previous application version against the expanded schema; no data is destroyed. This is why no contract step is permitted in this phase.

---

### M3 - Tenancy enforcement core (5-8 days)

Purpose: make tenant context a first-class, mandatory part of every authenticated path, before a second tenant can exist.

- [ ] `src/server/auth/tenancy.ts` with the helpers in section 5.2.
- [ ] Extend `SessionPayload` and `isSessionValid()` per section 5.1.
- [ ] Replace `loadHotelContext()` with `requireHotelContext(hotelId)`; update all 15 call sites across 7 files to pass an explicitly resolved hotel (F-02).
- [ ] Replace the three remaining first-row lookups (section 6.1).
- [ ] Change `API_FALLBACK` to deny unregistered `/api/admin` and `/api/platform` routes (F-08).
- [ ] Extend `AuditLog` writes with organization, hotel, actor type, IP, outcome; add `purpose` to platform access (F-13).
- [ ] Add an audit-write failure counter and alert so audit completeness is observable (today `writeAuditLog` swallows errors).
- [ ] Thread `hotelId` through `src/server/availability/service.ts` and `src/server/pricing/service.ts`, rejecting any room outside the resolved hotel (F-03, and the cross-tenant room-id edge case).
- [ ] Snapshot `Booking.currency` and `termsSnapshot` at confirmation (F-01, F-14); make `initiatePayment` read currency from the booking, not ambient settings.

**Gate:** existing `npm run authz:check` still passes. New `scripts/mt-authz-check.ts` (section 9.2) passes the cross-tenant negative matrix. A booking created at tenant A is priced, taxed, and paid in tenant A's currency regardless of tenant B's settings.

---

### M4 - Tenant console scoping (6-9 days)

Purpose: every existing `/admin` surface becomes organization- and property-scoped.

- [ ] Resolve resource -> hotel -> membership in every `/api/admin` and `/api/staff` handler (section 6.3).
- [ ] Scope all console reads and searches (section 6.2).
- [ ] Active-organization switcher with visible context on every administrative screen where data can change (NFR-016).
- [ ] Organization and membership management: invite, activate, scope to properties, revoke (REQ-019, REQ-020).
- [ ] Membership revocation must not delete historical attribution; audit rows keep the actor (REQ-020).
- [ ] Split the `/api/admin/guests/[id]` PATCH permission from `VIEW_GUESTS` (section 6.3).
- [ ] Tenant-scoped guest access: a hotel sees only guests reachable through its own bookings (REQ-025, NFR-003).
- [ ] Scope `SiteContent` to platform vs. tenant (F-12).
- [ ] Scope amenity CRUD and room-type amenity assignment (F-11); platform taxonomy read-only to tenants (MRD business rule 13).
- [ ] Scope promotions per hotel and make code resolution hotel-scoped (F-10).

**Gate:** with two tenants seeded, every admin/staff route passes the adversarial matrix in section 9.2. `npm test` green. A member of tenant B cannot reach any tenant A resource by id, list, search, export, or URL.

---

### M5 - Property lifecycle and platform governance (6-9 days)

Purpose: implement the publication lifecycle (REQ-014, REQ-015) and the operations workspace (Journey 5).

- [ ] `PropertyPublicationStatus` transitions with an allowed-transition table, mirroring the existing `BOOKING_TRANSITIONS` pattern in `src/server/booking/policy.ts`.
- [ ] Every visibility-altering transition writes a `ListingReview` row with actor, reason, and timestamp (REQ-043).
- [ ] Publication precondition checks: required identity, contact, address, policy, at least one active offer and sellable inventory (Journey 3.2, 3.5).
- [ ] Location verification: `locationVerification` and `locationPrecision` must be `PLATFORM_VERIFIED` before a pin renders; `NONE` renders "Map location unavailable" (REQ-018, REQ-011).
- [ ] Fix **F-20**: `isDemoMapLocation()` must throw in production, so a demo point cannot be enabled on a live deploy (Journey 7.3).
- [ ] `/platform` console: submission review queue, approve/reject with reason, pause, suspend, archive.
- [ ] Platform break-glass support access: distinct permission, mandatory `purpose`, fully audited, reviewable (REQ-026, REQ-044).
- [ ] Tenant suspension runbook: new bookings blocked, existing confirmed reservations remain fully serviceable (REQ-042).
- [ ] Tenant offboarding: listings and bookings stop, historical records retained (REQ-045).

**Gate:** Journey 3 and Journey 5 pass end to end. An incomplete or unverified listing cannot be published by any route, including direct API calls. Suspension drill demonstrates existing reservations remain manageable.

---

### M6 - Marketplace discovery and booking (8-12 days)

Purpose: the guest-facing marketplace (Journeys 1 and 2).

- [ ] Marketplace home and search across published properties, with pagination or bounded result sets (NFR-013).
- [ ] Two-stage search: page the candidate hotels, then compute availability and prices only for that page's room types. This is what keeps NFR-011 (2.5s p95) achievable once inventory spans many properties.
- [ ] Property detail pages at `/hotels/[hotelSlug]`, showing only that hotel's data (REQ-003, REQ-006).
- [ ] **URL and redirect policy (F-17, REQ-002)** - resolved explicitly:
  - `/hotels/[hotelSlug]` is the canonical property URL.
  - Legacy `/hotel` 301-redirects to `/hotels/<santo-hotel>`.
  - Legacy `/rooms/[roomTypeSlug]` 301-redirects to `/hotels/[hotelSlug]/rooms/[roomTypeSlug]` when that slug resolves to exactly one hotel.
  - If a slug becomes ambiguous (the same room-type slug exists at two hotels after the uniqueness relaxation), the legacy URL redirects to marketplace search rather than guessing.
  - Renames write a `PublicSlugRedirect` row, so old links keep working after a rename.
  - Booking lookup stays reference-based at `/pay/[reference]` and is unchanged (REQ-046).
- [ ] Property-scoped checkout: hotel identity, dates, occupancy, currency, and policies stay visible and unchanged through to confirmation (Journey 2.1).
- [ ] Server-side revalidation of ownership, inventory, price, currency, promotion eligibility, and policies immediately before confirmation (REQ-031).
- [ ] Currency disclosure everywhere; mixed-currency numeric ranking disabled until a conversion policy exists (REQ-007, REQ-040).
- [ ] Notifications identify the correct property and tenant (MRD section 12).
- [ ] Map view: one marker per property, no fabricated pins, list remains usable when maps are unavailable (REQ-010, REQ-011, Journey 7.4).

**Gate:** a guest can discover and complete a booking for two independently operated properties in different currencies, and the confirmed totals match each property's own pricing. Journey 1 and Journey 2 pass.

**Note:** this phase does **not** enable live multi-tenant payments beyond what is already approved. With the mock provider this is safe; enabling a real provider requires the merchant-of-record decision (section 11).

---

### M7 - Constraint enforcement (3-5 days)

Purpose: the contract phase. Tighten the database so isolation no longer depends on application discipline.

- [ ] Backfill any remaining nulls; verify `NOT NULL` is safe.
- [ ] Enforce `NOT NULL` on `Booking.hotel_id`, `Booking.currency`, `rooms.hotel_id`.
- [ ] Enforce tenant-scoped uniques (section 4.2): room-type name/slug, room number, promotion code - replacing the global constraints relaxed in M1.
- [ ] Add partial unique indexes for amenities: one for platform rows, one per organization for tenant rows.
- [ ] Add the composite foreign keys from section 4.3.
- [ ] Add a database check that a hotel's `latitude`/`longitude` are both present or both absent (already exists - preserve it), plus a check that `location_precision` is not `EXACT` without `PLATFORM_VERIFIED`.
- [ ] Run the full adversarial suite, including deliberate cross-tenant writes, and confirm they fail at the database.

**Gate:** deliberately writing a cross-tenant allocation, room, or payment fails with a constraint violation, not an application error. `npm test` and `scripts/mt-authz-check.ts` green. Migration applies cleanly to a production copy.

**Rollback:** this phase is the least reversible. Take a snapshot first; roll forward rather than back if a constraint is found to be wrong.

---

### M8 - Hardening, load, and cutover (5-8 days)

- [ ] Load test the agreed capacity profile; verify NFR-011 to NFR-014 with measured p95 numbers.
- [ ] `EXPLAIN` the marketplace search and availability queries against multi-tenant data; confirm indexes are used (`npm run db:indexes`).
- [ ] Full cross-tenant isolation matrix (section 9.2) run as a blocking CI gate.
- [ ] Backup, restore, and tenant-offboarding drills, with measured RTO/RPO (NFR-021).
- [ ] Incident response, support runbook, and payment reconciliation procedures documented and rehearsed (NFR-019 to NFR-021).
- [ ] Observability: tenant/property correlation identifiers in logs and metrics, with no secrets and no unnecessary guest PII (NFR-019, NFR-020).
- [ ] Accessibility pass on marketplace and tenant workflows (NFR-017).
- [ ] Cutover checklist with a named approver per line.

**Gate:** all MRD section 21 production-launch criteria pass for at least two independent tenants, with zero cross-tenant authorization violations and zero unexplained migration variance.

---

## 8. Definition of done (per task)

Extends the existing definition in [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md):

- Backend enforces the rule; the UI is not the boundary (REQ-023).
- Tenant and property context is explicit, and absence of context is an error (MRD business rule 12).
- The change is covered by a positive test and at least one cross-tenant negative test.
- Migrations run clean from an empty database **and** from a production copy.
- No historical booking's currency, totals, or terms changed as a side effect.
- New audit coverage exists for any sensitive mutation.
- Lint and typecheck pass.
- The ownership map in section 6 is updated if a new surface was added.

---

## 9. Testing strategy

### 9.1 Two-tenant fixture

Every isolation test runs against two organizations with deliberately overlapping display data: both have a "Deluxe" room type, both have room "101", both have a promotion, and both have guests. Overlap is the point - a test where the tenants are distinguishable by name proves nothing about scoping.

### 9.2 Adversarial isolation matrix

Extends the existing `scripts/p3-authz-check.ts` black-box HTTP harness (which already proves staff/guest separation, default-deny, revocation, and throttling) into `scripts/mt-authz-check.ts`. For **every** resource type - hotel, room type, room, rate, promotion, amenity, guest, booking, payment, audit entry, site content, membership - tenant B's session attempts:

| Surface class | Assertion |
|---|---|
| List / search / export | Tenant A rows never appear in tenant B's results |
| Detail by valid tenant-A UUID | 404, never 200; never 403 (existence must not leak) |
| Mutation (PATCH/DELETE) by valid tenant-A UUID | Rejected; tenant A's row unchanged |
| Create referencing a tenant-A parent | Rejected at the application **and** at the database (section 4.3) |
| Membership revoked mid-session | Next request denied; stale tenant-A URL cannot restore access |
| Organization switched | Every subsequent action uses the new context |
| Background job / webhook / export / notification without tenant context | Fails closed |
| Platform operator break-glass access | Allowed only with `purpose`; fully audited |

### 9.3 Migration reconciliation tests

- Counts per table per property before and after.
- Financial totals per currency compared **exactly**.
- Booking reference set identical; every reference resolves to the same booking with the same payment history.
- Every booking resolves to exactly one hotel; zero ambiguous rows.
- No user gained a platform role implicitly (REQ-047).

### 9.4 Regression

The existing suite (`tests/booking`, `tests/availability`, `tests/payments`, `tests/admin/console`, `tests/hotel-map`, `tests/currency`) must stay green throughout. It is the proof that single-property behaviour is preserved (MRD Journey 6).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| The 15 `loadHotelContext()` call sites are missed and one still resolves the oldest hotel | Make `requireHotelContext` require a parameter - the type system then fails the build. Grep gate forbidding `hotel.findFirst` outside `tenancy.ts` (only 5 such lines exist today, all listed in section 6.1). |
| Uniqueness relaxed in M1 but a code path still assumes global uniqueness | Grep gate on `findFirst({ where: { code } })`-style lookups; per-hotel duplicate checks added in M4 before any second tenant can be created. |
| Constraint phase breaks a working write path | Snapshot first; run the full suite against a production copy; roll forward. |
| Business decisions slip past M0 | Phases M1-M5 are deliberately scoped to proceed without them. Only M6 checkout and a real payment provider are blocked. |
| Audit completeness silently degrades | Alert on audit-write failure (M3); reconcile audit counts in `mt02-reconcile.ts`. |
| Performance regresses once inventory spans many properties | Two-stage search in M6; load test in M8 against the agreed capacity profile. |

---

## 11. Open decision register

Carried from MRD section 17. Each entry names what the plan does **without** the decision, so the programme is not held hostage to it.

| Decision | Owner | Blocks | Plan behaviour without it |
|---|---|---|---|
| Commercial model (commission / subscription / per-booking) | Business | Tenant terms, ledger | M0-M6 proceed. MVP launches with no platform fee. |
| **Merchant of record & settlement** | Finance/legal | **Live checkout, refunds, payouts** | **Hard blocker.** Mock provider only; real provider integration is out of scope until resolved. |
| **Launch geography & legal entity** | Business/legal | Tax, payment, privacy, currency | **Hard blocker** for live payments. |
| Currency conversion & comparison | Product/finance | Search ranking | Interim rule implemented in M6: show each property's currency, disable mixed-currency numeric ranking. |
| Tenant verification & listing review standards | Operations | Publication | M5 builds the lifecycle; the evidence checklist per geography is a configuration input, not a code change. |
| Guest support ownership & data access | Operations | Notifications, support | M6 identifies the property in every communication; first-line ownership is a staffing decision. |
| Tenant promotion rules | Product/finance | Discounts | M6 scopes promotions per hotel (M4/F-10). Platform-wide campaigns are a separate type, not built. |
| Tenant domains / white-label | Product | Routing | Correctly out of MVP. |
| Property sale / closure / transfer | Legal/operations | Offboarding | M5 provides suspend/archive; ownership transfer is a controlled, audited workflow deferred to a later phase. |
| Data retention & guest deletion | Legal/privacy | Deletion/export | M2 preserves records; no deletion job is built until periods are set. |
| Capacity targets & support SLA | Product/operations | NFR validation | **Required in M0** - without it M8 cannot measure NFR-011 to NFR-014. |

---

## 12. Success criteria

The programme is complete when the MRD section 21 production criteria are met and demonstrably measured:

- All P1 journeys pass end to end for at least two independent tenants.
- Zero cross-tenant authorization violations in the release matrix.
- Santo Hotel transactional data reconciles with zero unexplained difference.
- Availability, checkout, payment, cancellation, refund, and tenant suspension behaviour proven.
- Tenant support, payment reconciliation, incident response, backup/restore, and retention operations staffed and tested.
