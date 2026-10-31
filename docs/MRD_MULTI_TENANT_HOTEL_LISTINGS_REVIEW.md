# MRD Review: Multi-Tenant Hotel Listings

**Subject:** [MRD_MULTI_TENANT_HOTEL_LISTINGS.md](./MRD_MULTI_TENANT_HOTEL_LISTINGS.md) reviewed against [MRD_MULTI_TENANT_HOTEL_LISTINGS_CHECKLIST.md](./MRD_MULTI_TENANT_HOTEL_LISTINGS_CHECKLIST.md)
**Reviewer:** Engineering (codebase-verified against the current `main` tree)
**Date:** 2026-10-29
**Outcome:** **CONDITIONAL GO** - approved to enter Phase 0/1 planning. Not approved for live multi-tenant checkout.
**Follow-on:** [PLAN_MULTI_TENANT_HOTEL_LISTINGS.md](./PLAN_MULTI_TENANT_HOTEL_LISTINGS.md)

---

## 1. How to read this review

Each checklist item is scored:

| Verdict | Meaning |
|---|---|
| **PASS** | The MRD addresses the item at requirement quality. No further document work needed. |
| **PARTIAL** | The MRD addresses the item in principle but leaves a specific, nameable gap that the implementation plan must close. |
| **OPEN** | The MRD correctly flags this as a business decision that has not been made. This is correct MRD behaviour, but the item is not met and blocks the work it governs. |
| **FAIL** | The current codebase contradicts a MRD requirement. Must be fixed by the implementation plan. |

The MRD is a requirements document, not a code inventory - and it says so (section 5). Items marked **FAIL** below are therefore not MRD defects. They are defects in the *current implementation* that the MRD's requirements already prohibit. They are recorded here because the review could not be completed honestly without them, and because they change the effort estimate materially.

---

## 2. Product scope and outcomes

| # | Checklist item | Verdict | Evidence / gap |
|---|---|---|---|
| 2.1 | Marketplace vs. tenant-only SaaS positioning approved | **PARTIAL** | Sections 3 and 17 recommend "shared Santo discovery marketplace plus tenant operations workspace" and name product/business as the owner. The recommendation is coherent and internally consistent; the *approval* is outstanding. |
| 2.2 | MVP scope and explicit non-goals understood by product, operations, finance, engineering | **PARTIAL** | Section 8 gives a clean in/out split with 10 explicit exclusions. No acknowledgement record exists across the four named functions. |
| 2.3 | Roles cover guest, hotel owner, hotel manager/staff, marketplace operations, platform administrator | **PASS** | Sections 6.1-6.5 define exactly these five, each with a job statement and boundary conditions. |
| 2.4 | Public listing lifecycle and publication authority approved | **PARTIAL** | Section 7.3 defines seven states with attributable transitions and states the authority rule (a tenant cannot self-approve unless Santo later adopts self-publishing). Open question 6 keeps the self-publish decision open. |
| 2.5 | Guest discovery, booking, tenant operations, moderation, and Santo migration journeys independently testable | **PASS** | Seven journeys in section 9, each with a story, a stated reason for priority, and a named *Independent test* describing the fixture and the assertion. |

**Assessment.** Scope and positioning are the strongest part of the MRD. Journey 6 (preserve Santo) is correctly treated as P1 rather than as a migration afterthought.

---

## 3. Requirement quality

| # | Checklist item | Verdict | Evidence / gap |
|---|---|---|---|
| 3.1 | All functional requirements use unique sequential `REQ-XXX` IDs | **PASS** | REQ-001 to REQ-049, verified contiguous with no duplicates or gaps. NFR-001 to NFR-021 likewise contiguous and correctly separated from functional scope. |
| 3.2 | Every requirement is observable and has a test approach | **PARTIAL** | Journey acceptance scenarios make most requirements testable by reference. REQ-039, REQ-043, REQ-044, REQ-045 and REQ-049 are process/control statements whose verification method (log review, drill, reconciliation report) is implied rather than named. The plan assigns each a concrete test approach. |
| 3.3 | P1 covers property discovery, single-property booking, tenant onboarding, tenant isolation, platform governance, Santo continuity | **PASS** | Journeys 1-6 map one-to-one onto these six, all marked P1. Journey 7 (map) is correctly P2. |
| 3.4 | Requirements distinguish organization, hotel, room type, physical room, guest, and booking ownership | **PASS** | Section 7.1 terms table, section 7.2 ownership rules, section 12 entity/ownership matrix, and business rules 1-4 are mutually consistent. |
| 3.5 | Requirements cover direct-ID/API access, background jobs, webhooks, caches, exports, notifications - not only visible UI routes | **PASS** | REQ-022, REQ-023, REQ-026, REQ-027 plus the edge-case list ("A background job, webhook, export, report, notification, or cache lacks explicit tenant context"). Note: the current codebase has webhooks and notifications but no background jobs yet, so part of this is forward-looking and correctly so. |
| 3.6 | Success measures are user/business outcomes and include performance, trust/safety, migration, and conversion guardrails | **PARTIAL** | Section 4 gives five outcome measures, section 11 gives NFR-011 to NFR-014, section 16 gives the funnel and trust metrics. **Gap:** no numeric target, no baseline, and no agreed load profile is attached to any of them. NFR-011/012 state "under the agreed launch load profile" - the profile does not exist yet. This must be set in Phase 0 or the performance gates are unmeasurable. |
| 3.7 | Edge cases cover status transitions, duplicate identifiers, multi-membership, property suspension, currency, and historical bookings | **PASS** | Section 9 edge-case list covers all six, plus timezone boundaries, orphaned API identifiers, and tenant deletion under retention. |

**Assessment.** Requirement hygiene is high. The only structural weakness is 3.2 (verification method for control-type requirements) and 3.6 (unquantified targets), both of which are plan-stage work rather than MRD rewrites.

---

## 4. Security, privacy, and financial policy

| # | Checklist item | Verdict | Evidence / gap |
|---|---|---|---|
| 4.1 | Tenant-private data explicitly separated from intentional marketplace-wide identity | **PASS** | Section 7.2 (guest identity may be global; private records never exposed to a tenant not granted access through a booking), REQ-024/REQ-025, business rule 10. This is the correct and deliberate design, not an oversight. |
| 4.2 | Hotel tenant access to guest PII is reservation-scoped and approved | **PARTIAL** | REQ-025 and NFR-003 establish the principle. **Gap:** the field-level list of what a hotel sees before, during, and after the stay, and the retention/deletion timing, are open question 10. Legal approval is outstanding. |
| 4.3 | Platform support access is distinct, purpose-bound, and audited | **PASS** | REQ-026 (distinct platform permission, audited with actor/scope/reason/target/time/outcome), REQ-044 (least privilege, purpose-bound, reviewable), Journey 5.3, and the dedicated risk row on insider privacy risk. |
| 4.4 | Merchant of record, settlement, refund/dispute ownership, tenant financial reporting approved before live multi-tenant checkout | **OPEN - BLOCKER** | Section 17 states "No production payment routing decision assumed" and REQ-039 defers terms. The MRD is right to block this. Compounding factor from code: the only registered payment provider is a **mock** (`src/server/payments/provider.ts`, `REGISTRY = { mock }`), `PAYMENT_PROVIDER` defaults to `mock`, and `PAYMENT_WEBHOOK_SECRET` falls back to `SESSION_SECRET`. Live multi-tenant checkout is not merely unapproved; it is not currently implementable. |
| 4.5 | Supported countries, currencies, taxes, cross-currency display policy approved | **OPEN** | Section 17 leaves geography, tax responsibility, and cross-currency display open; REQ-007 and REQ-040 define the safe interim behaviour (disclose currency, disable mixed-currency ranking). That interim behaviour is the right default and is implementable without the decision. |
| 4.6 | Data retention, guest deletion, tenant offboarding, property ownership transfer approved | **OPEN** | REQ-045 and business rules 2 and 16 define the constraints (offboarding must not cascade-delete retained records). Jurisdiction-based retention periods are open question items owned by legal/privacy. |
| 4.7 | Location verification, map visibility, approximate locations, synthetic test-data handling approved | **PARTIAL** | REQ-010, REQ-011, REQ-018, NFR-018 and business rule 14 state the principles well, including "colour alone MUST NOT distinguish verified/approximate/demo/unavailable". **Gap in code:** `src/config/maps.ts` `isDemoMapLocation()` reads `NEXT_PUBLIC_MAP_DEMO_LOCATION === "true"` with **no production guard**, so a demo point can be enabled in production. Journey 7.3 explicitly requires that this be impossible. Recorded as **FAIL (F-21)**. |

**Assessment.** The MRD's security reasoning is sound and, in several places, better than the current implementation. The financial policy section is the correct hard stop: it is the only area where the MRD cannot safely be implemented on the current foundation, and the MRD already says so.

---

## 5. Migration and operations

| # | Checklist item | Verdict | Evidence / gap |
|---|---|---|---|
| 5.1 | Existing Santo Hotel explicitly the first tenant/property | **PASS** | Section 15, REQ-046, and assumption 2 ("Santo Hotel is the first tenant and remains a normal marketplace property, not a hard-coded special case"). Assumption 2 is the single most important sentence in the MRD and is correctly stated. |
| 5.2 | Bookings, payments, references, allocations, user access, financial snapshots have reconciliation criteria | **PARTIAL** | Section 15 names every reconciliation surface correctly. **Gaps:** no tolerance or owner is attached to any check, and one criterion cannot currently be met - see **F-01**, `Booking` has no `currency` column, so "financial totals compare exactly" has no durable currency to compare across a currency change. |
| 5.3 | Global-to-tenant uniqueness changes include a preflight conflict report and URL behavior | **PARTIAL** | Section 15 requires the duplicate/collision report and the risk table requires "stable public identifiers and redirect policy". **Gap:** the redirect policy itself is unspecified. This is not theoretical - `RoomType.slug` is globally unique and is the public URL `/rooms/[slug]`. Scoping that slug per hotel (which section 12 requires) breaks every existing link unless a redirect rule is defined. Recorded as **F-17** and resolved in the plan. |
| 5.4 | Migration backup, recovery, rollback/roll-forward, release gates defined | **PARTIAL** | Section 15 states the principles (versioned, reversible/forward-recoverable, no manual production edits, freeze or dual-write point) and section 14 defines per-phase exit gates. **Gap:** no concrete cutover sequence, RTO/RPO, or maintenance-window length. Plan section 8 supplies these. |
| 5.5 | Tenant suspension preserves the correct servicing path for existing confirmed reservations | **PASS** | Lifecycle states 5 and 6, REQ-042, Journey 2.5 ("the historical reservation remains manageable and is not silently cancelled"), section 15 suspension drill, and risk row 6. |
| 5.6 | Initial tenant/property/traffic targets and support SLA approved | **OPEN** | Section 17 SLA/capacity row is explicitly undecided, and NFR-014 makes capacity targets a launch precondition. |
| 5.7 | At least two-tenant integration and adversarial isolation tests planned | **PARTIAL** | Section 15 requires a cross-tenant matrix over "list, detail, mutation, export, search, webhook, cache, and background job surfaces" and section 21 requires two tenants for production. **Gap:** these are stated as requirements, not as executable tests with fixtures. Plan section 10 specifies them as a reproducible gate against the existing `scripts/p3-authz-check.ts` harness. |

---

## 6. Open decisions

All nine checklist decisions are open. The MRD handles this correctly by naming an owner and stating what each one blocks (section 17) rather than silently assuming an answer. Verdict for the section as a whole: **OPEN - correctly deferred**.

| Decision | Blocks | Severity |
|---|---|---|
| Commercial model | Tenant terms, payment ledger | High - but safely deferrable if MVP launches with no platform fee |
| Payment collection and settlement | Merchant of record, refunds, disputes, payouts | **Hard blocker** for live checkout |
| Launch geography and legal entity | Tax, payment, privacy, currency | **Hard blocker** for live checkout |
| Currency comparison and conversion | Search sorting and display | Medium - MRD's interim rule (show property currency, disable mixed ranking) is implementable now |
| Tenant verification and listing review | Onboarding and publication | High - gates supply growth |
| Guest support ownership and data access | Notifications, support workflows | Medium |
| Tenant promotion rules | Discounts and redemption | Medium - note F-10, a live defect today |
| Tenant-specific domains / white-label | Routing and brand | Low - correctly out of MVP |
| Property sale, closure, ownership transfer | Offboarding | Medium |

---

## 7. Readiness

| # | Checklist item | Verdict | Status |
|---|---|---|---|
| 7.1 | Product/business owners approve the marketplace position and MVP | **OPEN** | Sign-off outstanding |
| 7.2 | Operations/legal/finance approve the policies affecting publication and bookings | **OPEN** | Sign-off outstanding |
| 7.3 | Security/privacy approve the access and data-handling boundaries | **OPEN** | Sign-off outstanding |
| 7.4 | Engineering validates the source-to-tenant ownership assessment | **PARTIAL** | Section 22 requires this assessment before planning. It did not exist. This review produced it from the codebase: findings F-01 to F-21 below are the validated assessment, and plan section 3 is the resulting per-surface ownership map. Engineering can now close this item. |
| 7.5 | MRD ready to become a feature specification and implementation plan | **CONDITIONAL GO** | Yes for Phase 0 (decisions and inventory) and Phase 1 (tenant foundation and Santo migration). No for live multi-tenant checkout, which remains gated by 4.4 and 4.5. |

---

## 8. Codebase findings not stated in the MRD

These were verified against the current tree during review. They do not change the MRD's conclusions; they change the cost and sequencing of the work. Each maps to a plan task.

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **F-01** | `Booking` has no `currency` column. Subtotal, taxes, fees, discount and total are snapshotted, but the currency is read from ambient hotel settings at render time. REQ-032 and REQ-037 cannot be satisfied without adding it. | **Critical** | `prisma/schema.prisma` `model Booking`; currency supplied by `loadHotelContext()` in `src/server/pricing/context.ts` |
| **F-02** | `loadHotelContext()` resolves the hotel as `hotel.findFirst({ orderBy: { createdAt: "asc" } })` - the oldest row. It has **15 call sites across 7 files** (`booking/service.ts` x5, `public/search.ts` x3, `pricing/service.ts` x2, `payments/service.ts` x2, `console/settings.ts`, `console/guests.ts`, `console/dashboard.ts`), supplying currency, timezone, tax, fees, cancellation window and max rooms. Four further independent first-row lookups exist in three other files. With two hotels this silently prices and policies every booking against whichever hotel was created first. | **Critical** | `src/server/pricing/context.ts:46`; also `src/server/public/catalog.ts:64`, `src/server/console/settings.ts:73,83`, `src/server/console/catalog.ts:56` |
| **F-03** | Public catalog and availability are unscoped. `loadPublicRoomTypes()` and `findAvailability()` return every active room type in the database with no hotel filter. This is the exact failure mode the MRD's section 2 lists first. | **Critical** | `src/server/public/catalog.ts`, `src/server/availability/service.ts:250` |
| **F-04** | Five global unique keys make two hotels impossible: `RoomType.name`, `RoomType.slug`, `Room.roomNumber`, `Promotion.code`, `Amenity.name`. Two independent hotels cannot both have a "Deluxe" room type or room "101". | **Critical** | `prisma/schema.prisma` |
| **F-05** | A booking has no durable property association. Ownership is only derivable via `booking_rooms -> rooms -> room_types -> hotel_id`. Re-pointing a room type at another hotel would silently reassign historical reservations. | **Critical** | `prisma/schema.prisma` `model Booking` |
| **F-06** | Booking references are allocated by scanning `MAX(RIGHT(booking_reference, 6))` per year with an application-level retry loop. Correct for one hotel; a contention point at marketplace scale. The `SH-YYYY-NNNNNN` format must be preserved (REQ-046) but should be backed by a Postgres sequence. | High | `src/server/booking/reference.ts` |
| **F-07** | Authorization has no tenant dimension. `UserRole` is a global column on `User`; `guardApi` checks role and permission only; `SessionPayload` carries `{ kind, role, userId?, guestId?, email? }` with no organization claim. A staff user at hotel A is indistinguishable from one at hotel B. | **Critical** | `src/server/auth/roles.ts`, `src/server/auth/api.ts`, `src/server/auth/session.ts` |
| **F-08** | `API_FALLBACK: Access = { kind: "authenticated" }` means any unlisted `/api/**` path is reachable by *any* signed-in principal. Under NFR-002 (deny-by-default) that is a violation the moment a second tenant exists. | **High** | `src/config/access-map.ts:103` |
| **F-09** | Console read paths are global: `searchBookings`, `searchPayments`, `searchGuests`, `searchAudit`, `listRooms`, `listRates`, `listPromotions`, `listAmenities`, `getDashboard` carry no ownership predicate. | **High** | `src/server/console/*` |
| **F-10** | Promotion codes resolve globally (`promotion.findFirst({ where: { code } })`) and are unique globally. A code defined at hotel B is redeemable at hotel A. Redemption counting is correctly per-promotion; the *scoping* is not. | **High** | `src/server/pricing/service.ts:139`; `prisma/schema.prisma` `model Promotion` |
| **F-11** | Amenity CRUD and room-type amenity assignment are staff-permissioned with no hotel scope, so any staff user can attach another property's amenities to their own room type. | Medium | `/api/admin/amenities`, `src/server/console/catalog.ts` |
| **F-12** | `SiteContent` keys are global with "Santo Hotel" defaults baked in. Tenant property content and platform marketing content are not separable, which assumption 10 requires. | Medium | `src/server/console/settings.ts` |
| **F-13** | `AuditLog` has no organization, property, actor-type, IP or purpose columns, so REQ-026/043/044 cannot be evidenced. `writeAuditLog` also swallows write failures, so audit completeness has no reconciliation path. | **High** | `prisma/schema.prisma` `model AuditLog`; `src/server/audit/write.ts` |
| **F-14** | Payment intent currency is read from ambient hotel settings at initiation time rather than from the booking, so a settings change between booking and payment can desynchronise intent currency from booked currency. | **High** | `src/server/payments/service.ts` `initiatePayment` |
| **F-15** | One global payment provider registry (`REGISTRY = { mock }`), one webhook secret defaulting to `SESSION_SECRET`, and no per-tenant settlement account. Directly couples to the unresolved merchant-of-record decision. | **Critical** (for live payments) | `src/server/payments/provider.ts`, `src/config/payments.ts` |
| **F-16** | `updateRoomStatus` addresses a room by raw id with no ownership verification. | Medium | `src/server/booking/service.ts:981` |
| **F-17** | `RoomType.slug` is globally unique and is the public URL `/rooms/[slug]`. Scoping it per hotel (required by section 12) breaks every existing link without a redirect policy. | **High** | `prisma/schema.prisma`; `src/app/(site)/rooms/[slug]/page.tsx` |
| **F-18** | `Hotel.timezone` defaults to `Asia/Kuala_Lumpur` while `Hotel.currency` defaults to `NGN`. Inconsistent defaults will compute the wrong hotel-local "today" for a Nigerian property during migration. | Medium | `prisma/schema.prisma` `model Hotel` |
| **F-19** | `Guest.email` is globally unique. This is the correct consequence of the MRD's marketplace-wide guest identity, but it means a returning guest at hotel B reuses the profile created at hotel A. Intentional per assumption 5 - requires explicit approval and reservation-scoped disclosure enforcement. | Medium (by design) | `prisma/schema.prisma` `model Guest` |
| **F-20** | `isDemoMapLocation()` has no production guard, so a synthetic demo coordinate can be enabled in production. Journey 7.3 requires this to be impossible. | Medium | `src/config/maps.ts:24` |
| **F-21** | Positive finding, recorded so it is not "fixed": the availability ledger is already tenant-safe. `room_nights` primary key `(room_id, night)`, the sorted `FOR UPDATE` lock order, half-open `[check_in, check_out)` nights and the `release_room_nights_on_cancel` trigger are all per-room and remain correct under multi-tenancy. This design needs no change and should not be touched. | n/a | `prisma/migrations/20261006090000_p4_room_nights/migration.sql`; `src/server/availability/service.ts` |

---

## 9. Summary and recommendation

**The MRD is well written and should be approved as the requirements baseline.** Its numbering is clean, its ownership model is internally consistent, its journeys are independently testable, and - most importantly - it declines to assume answers to commercial questions it has no authority to decide. The review found no requirement that needs to be rewritten.

**Three things must happen before implementation planning closes:**

1. **Close the Phase 0 decisions** (section 6 of the plan). Two are hard blockers for live checkout: merchant-of-record/settlement, and launch geography/legal entity. Neither blocks the tenant foundation or the Santo migration.
2. **Accept the 21 codebase findings.** F-01 through F-05 and F-07 are critical and were not visible from the requirements alone. They make clear that tenancy cannot be layered on top of the current data access patterns; the ownership context must be threaded through them.
3. **Quantify the targets.** Section 3.6: no performance, capacity, or SLA number currently exists, so NFR-011 to NFR-14 have nothing to be measured against.

**Recommended approval statement:** *Approved as the requirements baseline for Phase 0 and Phase 1. Live multi-tenant checkout remains blocked pending the merchant-of-record, settlement, geography and currency decisions named in MRD section 17.*
