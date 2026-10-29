# Market Requirements Document: Multi-Tenant Hotel Listings

**Product:** Santo Hotel marketplace and property-management platform  
**Status:** Draft for product and business review  
**Audience:** Product, hotel operations, engineering, design, QA, finance, legal  
**Owner:** Santo Hotel product owner  
**Last updated:** 2026-10-29  
**Related documents:** [Development plan](./DEVELOPMENT_PLAN.md), [ERD](./ERD.md), [data dictionary](./DATA_DICTIONARY.md), [open questions](./OPEN_QUESTIONS.md), [Google Maps hotel map MRD](./MRD_GOOGLE_MAP_HOTEL_VIEW.md)

## 1. Executive summary

Santo Hotel is currently a single-property booking application. This proposal evolves it into a multi-tenant accommodation platform: multiple independent hotel operators can publish hotel listings, manage their own properties and room inventory, and receive reservations from a shared public discovery experience.

The public product is a marketplace, not merely a database that happens to contain more than one hotel. A guest should be able to discover properties, compare relevant details, check a selected property's availability and price, and complete a reservation without seeing another property's private operational or guest data. Each hotel remains the authority for its inventory, rates, policies, and operational decisions, subject to platform-wide publication, safety, and service rules.

The tenancy boundary is an **operator organization**. An organization may manage one or more hotel properties. A hotel is the customer-facing listing and the unit that owns its local inventory, policies, currency, address, and map location. This distinction supports both independent hotels and hotel groups without treating every hotel as a separate login silo.

The MVP recommendation is a Santo-managed, curated marketplace with tenant self-service operations. It does not assume a commission model, automated hotel payouts, custom domains, channel-manager integration, or a white-label booking website. Those require business and legal decisions before they are planned as committed scope.

## 2. Problem and opportunity

The current application has a single `Hotel` profile and derives public catalog, search, pricing, and policy context from the first hotel row. `RoomType` references a hotel, but several other records and uniqueness rules are global. Bookings do not record a hotel directly. Staff authorization uses global roles rather than organization membership. These assumptions are adequate for one property but cannot safely support unrelated hotel operators or a cross-property marketplace.

Without a deliberate product and tenant model, adding multiple hotel rows risks:

- showing one hotel's rooms, prices, promotions, or availability under another hotel's listing;
- allowing hotel staff to inspect or change another tenant's reservations and guest information;
- creating slug, email, room-number, amenity, promotion, or booking-reference collisions;
- applying a single hotel's tax, currency, cancellation, timezone, or payment configuration to another property;
- offering search results that imply availability or prices that are not valid for the selected property and stay;
- introducing demo or unverified coordinates as real hotel locations;
- making changes that strand existing Santo Hotel bookings or staff accounts.

The opportunity is to create a scalable discovery and operations product with clear ownership, tenant-safe workflows, and a migration path that preserves the current Santo Hotel business.

## 3. Product vision and positioning

**Vision:** Help travelers discover and book distinctive stays while giving each participating hotel dependable control of its public listing, inventory, rates, policies, and reservations.

**Positioning:** Santo is a curated multi-property accommodation marketplace and hotel operations console. Guests use one marketplace to browse properties. Hotel operators use authorized tenant workspaces to manage only their own properties. Santo platform operators govern tenants and marketplace quality.

**Product promise:**

1. A listing represents one real, independently bookable hotel property.
2. The hotel listing, room inventory, policies, and booking are kept together throughout discovery and checkout.
3. Availability, final price, payment state, and reservation confirmation are checked by trusted server-side workflows.
4. A property's unpublished, suspended, or unverified information is not presented as a bookable public offer.
5. Tenant separation is a product guarantee, not an optional convention for individual screens.

## 4. Goals and success measures

### Product goals

1. Onboard multiple independent hotel organizations while retaining Santo Hotel as the first tenant.
2. Let guests discover, filter, inspect, and book multiple properties from one public marketplace.
3. Give authorized hotel members a workspace scoped to their organization and assigned property permissions.
4. Preserve hotel-specific inventory, price, currency, timezone, policies, content, and location.
5. Prevent cross-tenant access to guest personal data, bookings, operational records, and management functions.
6. Preserve historical booking, payment, and audit records through migration and future tenant changes.
7. Support a property map and a multi-property map/search experience using only approved location data.

### Success measures

- An approved hotel can complete onboarding and publish a complete first listing without engineering assistance.
- A guest can search across active hotels, compare property-level offers, and finish a valid booking for a selected hotel.
- Tenant staff cannot read or mutate another tenant's private records through UI, URL, API, or stale sessions.
- Marketplace inventory, displayed rates, and booking-confirmed totals agree for the same property and stay.
- Existing Santo Hotel guest flows, bookings, pricing, and staff operations remain correct after migration.

## 5. Scope baseline and evidence

**Discovery method:** Reviewed the current product/domain documentation and the hotel, room, booking, settings, pricing, availability, and authorization models referenced by it.

**Current baseline:**

- `Hotel` is documented as the single-tenant identity/configuration record.
- `RoomType` has a `hotelId`; room types and their rates, physical rooms, images, and amenity assignments are reached through that relationship.
- `Booking` has no direct hotel ownership field; allocations lead to hotel identity through room records.
- `Guest`, `User`, `Amenity`, `Promotion`, and `SiteContent` currently use global identity or uniqueness assumptions.
- Hotel context and public catalog loading use the first hotel record rather than a guest-selected property.
- Existing search and checkout support one hotel's currency, pricing and policy context per request.
- Hotel map coordinates are stored on `Hotel` and are intended to be verified before being presented as a real location.

This is a product requirements baseline, not a complete source-code inventory. The implementation team must produce a tenant data-ownership map and a migration-impact inventory during planning.

## 6. Users, roles, and jobs to be done

### 6.1 Marketplace guest

**Job:** Find a suitable hotel for dates, party size, budget, location, and preferences; understand the property's offer and rules; complete a booking with confidence.

- May browse publicly without an account.
- May use a unified guest account for bookings across properties.
- Must be able to distinguish the hotel, room type, total/indicative price, stay dates, and applicable currency.
- Can view only their own reservations and account data.

### 6.2 Hotel owner / organization administrator

**Job:** Establish the organization's account, manage its properties and team, and ensure the organization's listings are accurate and bookable.

- Manages organization-level profile and membership.
- Manages one or more hotels only within their organization.
- Invites and removes tenant members and assigns permitted roles.
- Sees publication, verification, and operational status for their properties.

### 6.3 Hotel manager / property staff

**Job:** Run assigned property operations: keep rooms, rates, availability, policies, and reservations current.

- Access is granted through explicit organization/property membership.
- Capabilities are role/permission based and may differ by property.
- Does not automatically receive organization billing, user administration, or platform-wide access.

### 6.4 Santo marketplace operations

**Job:** Protect marketplace quality, onboard and verify hotel operators, resolve reports, and manage platform-wide controls.

- Can review and approve listing publication.
- Can suspend a tenant/property for documented policy or safety reasons.
- Access to guest or tenant-private records is restricted to operational need, permissioned, and audited.

### 6.5 Platform administrator

**Job:** Configure platform-wide security, policy, and service operations.

- Manages platform configuration and privileged support access.
- Must not use ordinary hotel staff permissions to access tenant data.
- All sensitive cross-tenant support access is attributable and auditable.

## 7. Recommended tenancy and listing model

### 7.1 Core terms

| Term | Product meaning |
|---|---|
| Platform | Santo marketplace and shared service operated by Santo. |
| Tenant organization | A hotel business or operator that owns/manages properties on Santo. |
| Hotel / property | A physical accommodation property and one public listing. |
| Listing | The approved, guest-facing representation of a hotel, including property details and bookable room offers. |
| Room type | A sellable accommodation category at exactly one property. |
| Physical room | A unit of inventory belonging to one room type at one property. |
| Tenant member | A user authorized to perform specified work for an organization and, where applicable, one or more properties. |
| Guest | A traveler who browses or books properties; guest identity may be shared across the marketplace, but private booking access is owner-restricted. |

### 7.2 Ownership recommendation

- A tenant organization owns zero or more hotels.
- Each hotel belongs to exactly one tenant organization.
- Each room type belongs to exactly one hotel; physical rooms, rates, images, and room-type features inherit that hotel ownership.
- A booking is for exactly one hotel in MVP. A multi-property itinerary/cart is out of scope.
- Each booking allocation must resolve to a room belonging to the booking's hotel.
- A guest identity may be global to the Santo marketplace; a guest's private records must never be exposed to a tenant that has not been granted access through a booking at one of its properties.
- Users may belong to more than one tenant organization or property, but every administrative action executes under an explicit active membership/context.

### 7.3 Public listing lifecycle

Recommended lifecycle:

1. **Draft** — editable by tenant; not publicly discoverable or bookable.
2. **Submitted** — tenant requests publication; required fields and verification evidence are supplied.
3. **Under review** — Santo operations checks identity, listing completeness, content, location, and policy requirements.
4. **Published** — discoverable and eligible for search; bookability still depends on active room offers and inventory.
5. **Paused** — intentionally hidden or temporarily not accepting new bookings; existing confirmed reservations remain serviceable.
6. **Suspended** — blocked by Santo for policy, trust, safety, payment, or compliance reasons; reason and review path are recorded.
7. **Archived** — no new bookings; historical reservations and audit records remain accessible according to retention rules.

Transitions that alter public visibility must be attributable and audited. A tenant cannot approve its own listing for public publication unless Santo explicitly adopts self-publishing after launch.

## 8. Scope

### In scope for the product direction

- Multiple tenant organizations and tenant-scoped memberships.
- One or more hotel listings per organization.
- Public marketplace discovery, filtering, listing detail pages, and property-specific booking.
- Hotel-specific catalog, room inventory, prices, availability, currency, timezone, map location, taxes/fees, cancellation and operating policies.
- Tenant onboarding and listing moderation/verification.
- Tenant management workspace and access control.
- Platform operations workspace for onboarding, moderation, suspension, and support.
- Guest reservation access, notifications, and support that identify the correct property and tenant.
- Migration of the existing Santo Hotel, its users, settings, inventory, guests, bookings, payment records, and content into the first tenant.
- Tenant-safe reports, audit, and operational views.
- Multi-property map/search only where hotel locations have been verified and publication permits their disclosure.

### Explicitly out of scope for the initial marketplace release

- One cart or reservation spanning multiple hotels.
- Room-by-room geographic pins or unverified neighborhood claims.
- OTA/channel-manager synchronization (for example, external travel marketplaces).
- Franchise/hotel-chain hierarchy beyond organization owning multiple hotels.
- White-label custom domains or fully separate branded tenant storefronts.
- Automated subscription billing, commission invoices, or automated property payouts until commercial and payment decisions are approved.
- Loyalty programs, package tours, transportation, event inventory, or restaurant booking.
- AI-generated rates or autonomous availability/pricing changes.
- Guest data sharing among tenants for marketing.
- Importing data from external hotel systems without a separately scoped integration.

## 9. User journeys and acceptance scenarios

### Journey 1 — Discover and compare properties (Priority P1)

**Story:** As a traveler, I can search the marketplace for a stay and compare eligible hotel listings so that I can choose a property before I book.

**Why P1:** Marketplace discovery is the primary guest value of multi-property operation.

**Independent test:** Seed two published hotels with distinct names, currencies, amenities, and inventory. Search and verify each result and its detail page resolve to the same hotel context.

**Acceptance scenarios:**

1. **Given** two published hotels have active offers, **when** a guest browses the marketplace, **then** each hotel appears once with its own name, location, primary image, and indicative offer.
2. **Given** one hotel is draft, paused, or suspended, **when** a guest searches publicly, **then** that hotel does not appear as a bookable result.
3. **Given** a guest applies dates, party size, and filters, **when** results render, **then** every result's availability and displayed offer are specific to that property and stay.
4. **Given** the guest opens a property detail page, **when** they inspect rooms and policies, **then** the page shows only data belonging to that hotel.
5. **Given** results contain different property currencies, **when** the guest compares them, **then** each price is clearly labeled and the product does not imply incomparable values are a single currency.

### Journey 2 — Book one selected property (Priority P1)

**Story:** As a traveler, I can select rooms at one hotel and complete a reservation under that hotel's policies so that the reservation is valid and unambiguous.

**Why P1:** A marketplace listing without trustworthy conversion to a property-scoped booking does not deliver the core business outcome.

**Independent test:** Create active inventory and rates at two hotels; book one and prove availability, total, booking record, payment, and confirmation identify only the selected hotel.

**Acceptance scenarios:**

1. **Given** a guest selects a hotel and room offer, **when** they proceed to checkout, **then** the hotel identity, dates, occupancy, currency, and applicable policies remain visible and unchanged.
2. **Given** rates or inventory change between search and checkout, **when** the guest confirms, **then** the system revalidates the selected hotel's current availability and price before creating/confirming the reservation.
3. **Given** a booking is created, **when** the guest or authorized staff views it, **then** the booking remains associated with exactly one hotel and preserves the commercial details used at confirmation.
4. **Given** a guest books hotel A, **when** hotel B staff search reservations, **then** that booking and its guest details are not returned.
5. **Given** a property is paused after a booking is confirmed, **when** staff operate that booking, **then** the historical reservation remains manageable and is not silently cancelled.

### Journey 3 — Onboard and publish a hotel (Priority P1)

**Story:** As a hotel owner, I can create an organization, add a hotel profile and room offers, submit the listing, and understand what is required before publication.

**Why P1:** Tenant supply must be safely and repeatably added before a marketplace can grow.

**Independent test:** Start with a new tenant, complete required profile and offer information, submit it, and verify that it remains hidden until approved.

**Acceptance scenarios:**

1. **Given** a new operator, **when** they create an organization, **then** the organization is assigned an initial owner and cannot access another organization's data.
2. **Given** a hotel profile is incomplete, **when** the owner submits it, **then** the system identifies the missing publication requirements and does not publish it.
3. **Given** a complete hotel is submitted, **when** Santo operations reviews and approves it, **then** it becomes discoverable only after approval and its public content reflects the approved version.
4. **Given** coordinate evidence is absent or unverified, **when** the listing is reviewed, **then** no precise map pin or fabricated location is displayed.
5. **Given** a hotel has no active offer or sellable inventory, **when** it is published, **then** its public status and search behavior clearly distinguish a profile page from bookable availability.

### Journey 4 — Operate a tenant workspace (Priority P1)

**Story:** As an authorized hotel team member, I can manage only my assigned properties' listings, room types, rates, inventory, and reservations.

**Why P1:** Tenant trust and daily property operations depend on correct, property-scoped workspaces.

**Independent test:** Assign users to separate tenants and attempt read and write operations against one another's resources through UI routes, direct requests, and identifiers.

**Acceptance scenarios:**

1. **Given** a tenant member signs in, **when** they open the console, **then** only properties granted by their active membership are available.
2. **Given** a user has read-only permission, **when** they attempt to update rates or reservations, **then** the update is denied even if they call the endpoint directly.
3. **Given** a member belongs to two organizations, **when** they switch active organization, **then** the workspace clearly identifies the selected context and every subsequent action uses it.
4. **Given** a member is removed or deactivated, **when** their existing session is used, **then** access is revoked promptly and cannot be restored by a stale property URL.
5. **Given** a tenant member performs a sensitive action, **when** an audit record is created, **then** it identifies the actor, organization, property (where relevant), action, target, time, and outcome.

### Journey 5 — Govern listings and support tenants (Priority P1)

**Story:** As Santo operations, I can review listings, resolve reports, pause or suspend unsafe listings, and provide controlled support without erasing the audit trail.

**Why P1:** An open marketplace needs publication controls and accountable privileged access.

**Independent test:** Submit listings with valid and invalid data, approve one, suspend another, and verify guest visibility, booking eligibility, and audit evidence.

**Acceptance scenarios:**

1. **Given** a submitted listing, **when** an operations user rejects it, **then** the hotel owner receives a reason and a clear correction path.
2. **Given** a listing is suspended, **when** guests search, **then** it is excluded from new bookings while existing reservations remain accessible to authorized operations.
3. **Given** a platform support user opens tenant-private information, **when** access is permitted, **then** the reason and relevant access are recorded and restricted to the required scope.
4. **Given** a platform role is removed or an operator account is disabled, **when** the next privileged request occurs, **then** access is denied.

### Journey 6 — Preserve the existing Santo Hotel (Priority P1)

**Story:** As the existing Santo Hotel operator and guest, I can continue using current listings, reservations, payments, and staff workflows after migration.

**Why P1:** Multi-tenancy must not compromise existing paid or operational commitments.

**Independent test:** Migrate a representative database snapshot, compare record counts and immutable financial snapshots, then exercise search, booking, refund, guest history, and staff operations for the original property.

**Acceptance scenarios:**

1. **Given** the current single hotel is migrated, **when** the marketplace is enabled, **then** Santo Hotel is represented as the initial organization/property without changing historical booking amounts or currencies.
2. **Given** an existing booking reference, **when** it is looked up after migration, **then** the same booking and payment history are returned with the correct Santo Hotel association.
3. **Given** existing staff users, **when** migration completes, **then** their intended access is assigned to the Santo tenant and no user is silently granted platform-wide privilege.
4. **Given** a migration validation fails, **when** rollout is attempted, **then** marketplace cutover is blocked and a documented recovery path is available.

### Journey 7 — Use the property/map view (Priority P2)

**Story:** As a traveler, I can understand where a hotel is while comparing properties, without confusing a demo point, approximate location, or room with the hotel's verified location.

**Independent test:** Search two properties with verified coordinates, one without coordinates, and one with a synthetic development location; verify markers, labels, and missing-location behavior.

**Acceptance scenarios:**

1. **Given** published hotels have approved coordinates, **when** a guest uses map search, **then** one marker represents each hotel and selecting it opens that hotel's listing.
2. **Given** a hotel has no approved coordinates, **when** it appears in a list, **then** it has no fabricated marker and its address remains available as text.
3. **Given** development demo coordinates are configured, **when** the map renders, **then** a conspicuous demo-only label appears and the same setting cannot be enabled in production.
4. **Given** map services are unavailable, **when** a guest browses, **then** the hotel list, search filters, and booking flows remain usable.

### Edge cases

- Duplicate hotel, organization, room-type, room-number, promotion, or public-slug values across different tenants.
- A global guest has bookings at multiple hotels but must not see another guest's booking.
- A tenant member has access to multiple properties, is transferred, or loses access while logged in.
- A hotel is unpublished, suspended, archived, sold, transferred, or has its operator account closed while bookings are upcoming.
- A booking is modified, cancelled, refunded, or disputed after a hotel leaves the marketplace.
- A property has mixed, missing, expired, or invalid rates or no inventory for selected dates.
- Two hotels have identical display names or addresses, or similar slugs.
- A reservation's room is reassigned, a room type is removed, or a tenant tries to change historical booking data.
- A requested multi-room stay spans room types or properties; MVP must not silently split it across hotels.
- An API request includes a valid record ID belonging to another tenant.
- A background job, webhook, export, report, notification, or cache lacks explicit tenant context.
- A public search query contains an unknown, suspended, or unpublished hotel identifier.
- Hotel-local timezone date boundaries differ from the platform timezone.
- A tenant's local currency differs from the guest's display preference or another result's currency.
- A listing has no verified map location, an intentionally approximate location, or a local demo point.
- A tenant is deleted while legally or operationally retained bookings, payments, or audit records exist.

## 10. Functional requirements

### Marketplace discovery and listing

- **REQ-001:** The marketplace MUST allow the public to browse only listings whose publication state permits public discovery.
- **REQ-002:** Each property listing MUST have a stable public identifier/URL that is unique across the marketplace and remains safe to resolve after a display-name change.
- **REQ-003:** Each public listing MUST show the owning property's identity, approved address/location, core amenities, images, policies, and available room offers without mixing data from another property.
- **REQ-004:** Guests MUST be able to search by stay dates, occupancy, destination/location, and supported property/room filters; results MUST be scoped to properties satisfying the requested criteria.
- **REQ-005:** Search MUST show property-level availability and rates for the requested stay or clearly label any price as indicative and not availability-confirmed.
- **REQ-006:** A guest MUST be able to open a property detail page from every result, and the selected property MUST remain explicit through room selection and checkout.
- **REQ-007:** Marketplace sort, filter, and price comparison MUST disclose currency; the product MUST NOT rank different currency amounts as if they were directly comparable unless an approved conversion rate and display policy are in place.
- **REQ-008:** An empty result, unavailable API, or incomplete listing MUST leave guests with a usable recovery path and MUST NOT reveal unpublished tenant data.
- **REQ-009:** Public search MUST exclude suspended, archived, draft, or otherwise non-discoverable listings and offers.
- **REQ-010:** The map view MUST show one marker per property with approved coordinates, not one marker per room or room type.
- **REQ-011:** Map and list selection MUST resolve to the same hotel listing; a property without publishable location data MUST remain understandable in the list without a guessed pin.

### Tenant onboarding and property management

- **REQ-012:** The platform MUST support tenant organizations that own or manage one or more hotel properties.
- **REQ-013:** A tenant MUST be able to create and maintain its organization profile and assigned properties within its granted permissions.
- **REQ-014:** A property MUST support draft, submitted, review, published, paused, suspended, and archived states with allowed transitions and attributable reasons.
- **REQ-015:** A property MUST NOT become publicly bookable until its required identity, contact, address, policy, offer, and verification criteria have been satisfied and approval rules have passed.
- **REQ-016:** Tenant users MUST be able to manage their room types, physical inventory, room images, amenities, rates, availability, promotions (if enabled for the tenant), policies, and listing content only for their permitted properties.
- **REQ-017:** Property management MUST preserve a distinction between room type and physical room inventory.
- **REQ-018:** Tenant-managed location data MUST identify its verification status and source; synthetic demo coordinates MUST never be accepted as production verification evidence.
- **REQ-019:** Tenant members MUST be invitable, deactivatable, and assignable to one or more organizations/properties with explicit permissions.
- **REQ-020:** Removing a member or reducing permission MUST revoke future access without deleting historical attribution.

### Tenant isolation and authorization

- **REQ-021:** Every hotel-owned operational or commercial record MUST resolve to exactly one tenant/property ownership context.
- **REQ-022:** Every authenticated tenant read, write, export, search, notification, and background action MUST be authorized against an active tenant membership and the target property's ownership.
- **REQ-023:** Tenant boundaries MUST be enforced for direct resource identifiers and API requests, not only by hiding navigation or filtering client-side.
- **REQ-024:** A tenant MUST NOT read, infer, update, delete, export, or enumerate another tenant's private records, including guest PII, bookings, payments, rates, room numbers, audit entries, and unpublished content.
- **REQ-025:** A guest MUST access only their own account and reservation records; their marketplace-wide account MUST NOT make their personal data available to other hotels outside the reservation workflow.
- **REQ-026:** Platform-wide privileged access MUST use a distinct platform permission and MUST be audited with actor, scope, reason, target, time, and outcome.
- **REQ-027:** Background jobs, scheduled tasks, webhook processing, caches, and analytics MUST preserve the correct tenant/property context or explicitly operate as platform-level work with documented authorization.

### Property-scoped search, availability, pricing, and booking

- **REQ-028:** Every search result and offer MUST identify its property owner and use that property's inventory and operational context.
- **REQ-029:** Availability MUST be evaluated only against eligible physical rooms belonging to the selected property and MUST continue to prevent double booking under concurrent requests.
- **REQ-030:** A booking MUST represent a stay at exactly one hotel in the initial release.
- **REQ-031:** Checkout MUST revalidate property ownership, room assignment, inventory, price, currency, promotion eligibility, and property-specific policies before reservation confirmation.
- **REQ-032:** A booking MUST retain a durable property association and historical snapshots of the relevant listing identity, room descriptions, rates, currency, tax/fee treatment, cancellation terms, and totals so later edits do not rewrite the agreed reservation.
- **REQ-033:** Hotel-local timezone MUST govern date-sensitive operational policies; guest-facing dates and times MUST identify the property's local context where ambiguity is possible.
- **REQ-034:** A booking, refund, payment event, cancellation, or chargeback MUST not affect inventory, funds, policy configuration, or notifications belonging to another tenant.
- **REQ-035:** The platform MUST preserve current guest booking functionality where account-less checkout is enabled, while providing a property-aware confirmation and support path.

### Commercial configuration and tenant financial boundaries

- **REQ-036:** Each property MUST have its own transaction currency and property-specific price, tax, fee, check-in/out, cancellation, and service policy settings unless an explicitly approved platform policy overrides a setting.
- **REQ-037:** A tenant MUST not be able to change an existing booking's currency or historical financial snapshots by editing current property settings.
- **REQ-038:** Payment and refund records MUST remain attributable to the tenant/property booking that caused them; the system MUST NOT store raw card credentials.
- **REQ-039:** If platform commissions, subscription charges, settlement, or split payments are introduced, the guest and tenant MUST be shown the applicable commercial terms before launch and the platform MUST retain auditable gross, fee, tax, net, and payout evidence.
- **REQ-040:** A public price displayed in a converted currency MUST be labeled as a display estimate; checkout and payment MUST use the selected hotel's supported transaction currency unless an approved currency-conversion product is adopted.

### Platform governance, support, and audit

- **REQ-041:** Santo operations MUST be able to review listing submissions, approve or reject them with a reason, and pause or suspend listings under documented policy.
- **REQ-042:** Suspensions MUST block new public bookings according to policy while preserving access to existing reservations and required records.
- **REQ-043:** Sensitive tenant management, membership, publication, location, rate, reservation, and financial changes MUST be auditable with tenant/property context and actor identity.
- **REQ-044:** Platform support access to guest or tenant-private information MUST be limited to least privilege, purpose-bound, attributable, and reviewable.
- **REQ-045:** Tenant offboarding MUST stop new listings/bookings while preserving historical records for legal, payment, dispute, and operational retention needs.

### Migration and continuity

- **REQ-046:** The existing Santo Hotel MUST become the initial tenant/property without changing existing booking references, guest ownership, payment history, room allocations, booking statuses, or historical monetary snapshots.
- **REQ-047:** Existing staff/admin accounts MUST be assigned explicit first-tenant memberships according to a reviewed role mapping; existing global administrator status MUST NOT implicitly become marketplace super-administrator access.
- **REQ-048:** The migration MUST detect and report uniqueness conflicts, missing ownership paths, orphaned records, invalid property data, and ambiguous historical bookings before cutover.
- **REQ-049:** The marketplace MUST not launch until migration reconciliation, tenant isolation testing, backup/restore, and rollback criteria pass.

## 11. Non-functional requirements

### Security and privacy

- **NFR-001:** Cross-tenant confidentiality and integrity are release-blocking; all tenant-owned records and operations have explicit ownership context.
- **NFR-002:** Tenant authorization is deny-by-default and is tested for positive, negative, guessed-ID, changed-tenant-context, and revoked-membership cases.
- **NFR-003:** Sensitive guest data is collected only for reservation service and legal requirements, and is disclosed to a hotel only when needed to fulfill that hotel's reservation.
- **NFR-004:** Payment card data is handled by the selected payment provider; the application stores provider references and booking financial evidence, not raw card data.
- **NFR-005:** Secrets and tenant credentials are never committed, logged, or exposed in public listings.
- **NFR-006:** Audit and data-retention access is controlled, reviewable, and consistent with applicable privacy and financial regulations.

### Reliability and correctness

- **NFR-007:** Inventory and booking correctness must remain reliable under concurrent guest checkouts and staff operations.
- **NFR-008:** A failure in a third-party map, payment, messaging, or image service must not expose another tenant's data or create a success-shaped booking/payment state.
- **NFR-009:** Critical listing, booking, payment, cancellation, and tenant-membership operations must have explicit recoverable failure states and auditable outcomes.
- **NFR-010:** Data ownership and historical booking facts must remain consistent through edits, tenant suspension, property closure, and data migration.

### Performance and scale

- **NFR-011:** At launch, marketplace search MUST return the first usable result page within 2.5 seconds at the 95th percentile under the agreed launch load profile.
- **NFR-012:** Property detail and tenant console pages MUST render their primary content within 2.5 seconds at the 95th percentile under the agreed launch load profile.
- **NFR-013:** Search and property browsing MUST support pagination or bounded result sets; no public query may return an unbounded inventory or tenant dataset.
- **NFR-014:** Capacity targets (tenants, properties per tenant, listings, active inventory, concurrent searches/bookings) MUST be approved before production launch and validated by load testing.

### Usability and accessibility

- **NFR-015:** Guests must be able to distinguish property, room offer, stay dates, total/indicative price, transaction currency, and key policies before booking.
- **NFR-016:** Tenant members must be able to identify their active organization/property context on every administrative screen where data can be changed.
- **NFR-017:** Guest marketplace and tenant workflows MUST support keyboard operation, assistive technology labels, visible focus, sufficient contrast, and responsive layouts at supported phone, tablet, and desktop sizes.
- **NFR-018:** Location precision and verification status MUST be communicated honestly; color alone MUST NOT distinguish verified, approximate, demo, or unavailable map states.

### Operations and observability

- **NFR-019:** Operational logs and metrics MUST include safe tenant/property correlation identifiers without including secrets or unnecessary guest PII.
- **NFR-020:** Platform operators MUST be able to identify tenant-scoped errors, failed jobs, payment reconciliation gaps, and publication failures without broad access to guest details.
- **NFR-021:** Backup, restore, retention, support, tenant offboarding, incident response, and disaster recovery procedures MUST be documented and tested before production launch.

## 12. Key entities and ownership

| Entity | Ownership / meaning | Product requirements |
|---|---|---|
| Tenant organization | Hotel operator/business using Santo | Owns memberships and one or more properties; lifecycle and verification status. |
| Tenant membership | User-to-organization/property authorization | Role, property scope, status, invitation/activation and revocation history. |
| Hotel property | Physical property and public listing | Belongs to one tenant; owns address, coordinates, timezone, transaction currency, policies, publication status and local brand profile. |
| Listing version/review | Publicly approved property content | Tracks submitted/published versions, reviewer, status, decision reason and effective time. |
| Room type | Sellable accommodation category | Belongs to one property; uniqueness is scoped to the property; owns descriptions, occupancy, images and amenities. |
| Physical room | Inventory unit | Inherits property ownership through room type; room numbers are unique within the owning property. |
| Amenity / feature | Descriptive capability | Platform taxonomy may be shared; tenant-specific labels/custom values need moderation and scoped identity. |
| Rate / offer | Price rules for a room type and date range | Belongs to a property-owned room type; transaction currency follows property rules. |
| Promotion | Discount rule | Ownership and applicability must be explicit; code uniqueness and redemption counts must respect the defined tenant/platform scope. |
| Guest | Marketplace traveler identity | May span properties; personal data remains private and exposed only for reservations the property must fulfill. |
| Booking | Reservation and commercial record | Exactly one property in MVP; immutable snapshots plus guest link, stay, price, policy, status and source channel. |
| Booking allocation / room night | Inventory allocation | Must resolve to a room in the booking's hotel; double-booking protection remains property-safe. |
| Payment / refund | Financial event | Inherits booking property/tenant; provider account and settlement ownership are explicit. |
| Notification | Guest/operator communication | Must include booking/property context, use property branding/contact rules where appropriate, and not leak cross-tenant data. |
| Audit event | Accountability record | Includes actor, tenant, property scope, target, action, changes, timestamp and support-access reason where applicable. |
| Platform operator | Santo marketplace authority | Separate platform-level permissions from tenant roles; privileged actions audited. |

## 13. Business rules and policy principles

1. A public hotel listing is never an ownership boundary by itself; the tenant organization is the operator boundary and each hotel is a separately scoped property.
2. A hotel is owned by one tenant at a time. Property transfer requires a controlled, audited workflow that preserves booking history and assigns future operational responsibility.
3. Each room, room type, rate, availability record, promotion, policy, and booking must resolve to an owning property.
4. One guest booking covers exactly one property in the first release.
5. Availability and booking confirmation are recalculated server-side for the selected property; search results are not a booking guarantee.
6. Each property controls its own local timezone, currency, rates, taxes/fees, check-in/out, cancellation rules, inventory, and contact details, within platform guardrails.
7. Public listing content is published only after the listing meets platform review rules; an operator cannot bypass moderation by guessing a public ID or route.
8. A listing can stop accepting new bookings without erasing its existing obligations.
9. A property's displayed name, public slug, or current policies may change; a confirmed booking's historical identity and commercial terms remain available.
10. A guest account can serve multiple properties, but hotel tenants see only guest data needed to service their own reservations.
11. Staff roles and permissions are granted through membership, not inferred from email domain, a global role, a hotel ID in the URL, or user-provided request data.
12. Tenant and property context is explicit for background jobs, exports, webhooks, notifications, and analytics; absence of context is an error unless the task is intentionally platform-wide.
13. Global/shared taxonomy (for example, standard amenities) is curated by Santo; tenant-created taxonomy is scoped or reviewed and cannot overwrite shared records.
14. Map pins represent approved property locations only. A room type is never a separate geographic listing. Synthetic coordinates are development-only and visibly labeled.
15. Currency conversion, commission, payout, tax remittance, and payment-provider settlement behavior are not inferred from display currency or property ownership.
16. Historical bookings, payments, refunds, and audit events are retained according to approved legal and operational policies and are not cascaded away during tenant offboarding.

## 14. Proposed release plan

### Phase 0 — Business and security decisions

- Approve marketplace business model, tenant verification, payment/settlement approach, supported countries/currencies, and service responsibility.
- Define organization/property/user roles and the tenant access matrix.
- Agree initial launch capacity targets, listing content requirements, operational support, data retention, and legal terms.
- Produce a source-to-tenant data ownership matrix covering every table, API, route, background job, cache, report, webhook, and notification.

**Exit gate:** Product, legal/finance, hotel operations, security, and engineering sign off on the open decisions that block safe bookings.

### Phase 1 — Tenant foundation and Santo migration

- Introduce organization and membership concepts, explicit property ownership, and tenant/property authorization.
- Scope tenant-managed records, uniqueness rules, audit events, booking context, policies, and settings.
- Migrate the current Santo Hotel and existing users/bookings into the first organization/property.
- Add tenant isolation tests, migration reconciliation, backup/restore, and operational support controls.
- Keep public experience behavior equivalent to the current single-property site.

**Exit gate:** Santo's existing end-to-end booking and operations pass; cross-tenant negative tests pass; migration recovery is proven.

### Phase 2 — Tenant onboarding and listing governance

- Add tenant registration/invitation, organization profile, property setup, room and rate setup, verification, submission/review, publication, pause, and suspension.
- Provide understandable completeness checks, review feedback, and property health indicators.
- Enable one organization to manage multiple properties and member-to-property assignments.

**Exit gate:** A second independent hotel can be safely onboarded and operated without database/manual code changes.

### Phase 3 — Public marketplace discovery and booking

- Add marketplace home/search, destination/property filters, listing cards/detail pages, room offers, property-scoped availability and checkout.
- Preserve single-property checkout and authoritative server price/inventory checks.
- Add explicit currency display rules and guest communications identifying the property.
- Add multi-property map interaction only for approved location data.

**Exit gate:** A guest can discover and complete a booking for two independently operated properties; tenant isolation, payment reconciliation, and support runbooks pass.

### Phase 4 — Commercial scale and integrations (separate approval)

- Consider commission/subscription, payout automation, custom domains, white-label experiences, channel managers, external listing import, group analytics, and expanded locales.
- Each capability receives its own product, legal, security, operational, and integration assessment.

**Exit gate:** No phase-4 capability is implicitly included in the initial marketplace commitment.

## 15. Migration and launch requirements

### Migration principles

- Preserve the current Santo Hotel as the initial live property and tenant.
- Use a versioned, reversible/forward-recoverable migration plan; do not make manual production database edits.
- Preserve booking references, status, payment provider references, amounts, currency, guest association, room allocations, timestamps, and audit history.
- Add explicit ownership to historical rows by following existing relationships and validating that each row maps to exactly one property.
- Do not infer a booking's hotel from current room-type naming, current listing slugs, or mutable configuration if the historical allocation path is ambiguous.
- Resolve global uniqueness conflicts before enforcing tenant-scoped uniqueness; report conflicts rather than silently renaming commercial records.
- Retain platform-level global identity only where intentional (for example, global guest account email); scope tenant-owned identifiers (for example, room number and room-type slug) to their owner.
- Define rollback/roll-forward strategy, backup snapshot, downtime/maintenance window, and a point at which writes are frozen or dual-written.

### Pre-launch reconciliation

- Counts by tenant/property for hotels, room types, rooms, rates, images, bookings, room allocations, room nights, payments, refunds, notifications, promotions, users/memberships, and audit events.
- Referential checks that all hotel-owned records map to a valid tenant and property.
- Financial totals and booking snapshots compare exactly before/after migration.
- Duplicate and collision report for emails, room numbers, slugs, promotion codes, amenity identifiers, and booking references.
- Search results, property details, checkout, booking lookup, cancellation, refund, and staff dashboards tested for both migrated and newly onboarded properties.
- Cross-tenant access test matrix covers list, detail, mutation, export, search, webhook, cache, and background job surfaces.
- Tenant offboarding and property suspension drill demonstrates existing confirmed reservations remain supported.

## 16. Metrics and analytics

### Marketplace funnel

- Search-to-property-detail click-through rate.
- Property-detail-to-availability-search rate.
- Availability-to-checkout conversion.
- Checkout completion and payment-confirmation rates by property and currency.
- Search zero-result rate by destination, date window, and occupancy.
- Cancellation, failed payment, booking conflict, and guest-support contact rates.

### Tenant supply and quality

- Tenant application-to-approval time.
- Approved tenant and active property counts.
- Listing completeness and percentage with verified address/location.
- Time from tenant creation to first published offer and first booking.
- Property response/operational health and content rejection reasons.
- Suspension and complaint rates, with privacy-preserving aggregate reporting.

### Trust, safety, and isolation

- Cross-tenant authorization defect count; target is zero accepted violations.
- Unauthorized requests denied and investigated.
- Tenant support-access audit coverage; target is 100% of privileged access attributable.
- Booking/settlement reconciliation gaps and time to resolution.
- Data migration variance; target is zero unexplained variance for critical transactional records.

### Guardrails

- Marketplace conversion must not improve at the cost of increased invalid bookings, double bookings, hidden fees, or payment reconciliation failures.
- Analytics access must be role-scoped and must not expose row-level guest PII across tenants.

## 17. Dependencies and decisions required

These are business decisions and must be answered before the corresponding work is treated as committed scope. The recommendations below are defaults for planning, not approved commercial policy.

| Decision | Recommended planning default | Decision owner | Blocks |
|---|---|---|---|
| Marketplace model vs. tenant-only SaaS | Shared Santo discovery marketplace plus tenant operations workspace | Product/business | Public IA, tenant setup, launch scope |
| Tenant organization relationship | One organization may own/manage multiple hotels; one hotel has one owner at a time | Product/operations | Tenant model and membership |
| Onboarding and verification | Santo-reviewed approval before public booking | Operations/trust | Listing lifecycle |
| Tenant roles | Organization owner/admin plus property-scoped manager/staff; separate platform operator | Product/security | Access matrix |
| Commercial model | Defer commissions/subscriptions in MVP; do not imply free/paid terms | Business/finance | Tenant terms and payment ledger |
| Merchant of record and payouts | No production payment routing decision assumed; select platform vs direct hotel settlement before marketplace checkout | Finance/legal/payment owner | Payment provider, onboarding, refund/dispute flow |
| Supported launch geography | Launch region and legal entity must be confirmed; current NGN usage does not establish a multi-country legal policy | Business/legal | Tax, payment, privacy, currency |
| Cross-currency display | Show each property's transaction currency; cross-currency sort/comparison disabled until conversion policy exists | Product/finance | Search sorting and display |
| Tax and fee responsibility | Property-specific configuration within legal/platform guardrails; who calculates, collects, remits, and displays taxes must be confirmed | Finance/legal/hotel ops | Price breakdown and invoices |
| Booking communication/support | Confirm whether Santo or the hotel owns first-line guest support and post-booking changes | Operations | Notifications, support workflows |
| Listing verification | Confirm required business/license, address, bank, image, and safety evidence per launch geography | Legal/operations | Onboarding and publication |
| Property ownership transfer | Existing bookings remain with the servicing entity until explicit transfer/novation policy is approved | Legal/operations | Sale, closure, tenant offboarding |
| Data retention/deletion | Define jurisdiction-based guest, financial, and audit retention; tenant offboarding does not immediately delete records | Legal/privacy | Deletion/export requirements |
| White-label/domain support | Out of MVP; marketplace URLs first | Product/marketing | Routing and brand architecture |
| Tenant-specific promotion scope | Promotions belong to a hotel in MVP; platform-wide campaigns are a separately authorized type | Product/finance | Discounts and redemption rules |
| Map visibility | Only verified property coordinates are published; approximate location requires explicit guest-facing labeling and approval | Operations/privacy | Geo-search and maps |
| SLA and capacity | Establish support coverage, availability, traffic, and tenant/property launch targets | Product/operations | NFR validation and staffing |

## 18. Assumptions

1. The marketplace is operated by Santo and is not a peer-to-peer platform where any unreviewed host may immediately publish.
2. Santo Hotel is the first tenant and remains a normal marketplace property, not a hard-coded special case.
3. The first release handles a single property per reservation; guests may create separate reservations at different hotels.
4. A business operator may own multiple hotel properties, and members may have scoped access to multiple properties.
5. Guest identity is marketplace-wide for convenience, but tenant access to guest information is reservation-scoped.
6. Each property has one transaction currency in the initial product; user display preference does not change the booking currency.
7. Hotel profiles and room offers are managed by tenant members but may require Santo approval before public display.
8. Existing single-property booking rules (availability recheck, holds, room-night conflict protection, and financial snapshots) remain authoritative.
9. Hotel map locations are verified and property-level; synthetic development points are never presented as production locations.
10. Existing global site content does not automatically become tenant content. Tenant-facing property content and platform-wide marketing content have separate ownership and publication rules.

## 19. Open questions for product owner

1. Confirm the marketplace model and the name/brand relationship between the Santo marketplace and tenant hotel brands.
2. Decide commission, subscription, per-booking fee, or no-fee launch terms; clarify who invoices whom.
3. Select merchant of record, settlement route, payout frequency, refund/dispute responsibility, and failed-payout process.
4. Confirm initial legal jurisdictions and the supported property and guest currencies.
5. Decide whether cross-currency price comparison is excluded or uses a third-party conversion rate, and how/when that rate is disclosed.
6. Confirm whether each hotel can self-publish after automated checks or requires human review for every change.
7. Define required identity/license/safety verification for a hotel and what content/location evidence can be public.
8. Decide if tenants may configure hotel-specific promotions in MVP and how platform campaigns combine with them.
9. Define who handles guest support before arrival, during a stay, for cancellation, and for chargebacks.
10. Decide guest data visibility: what fields a hotel receives before, during, and after the stay, and retention/deletion timing.
11. Define the consequences of hotel sale, closure, suspension, bankruptcy, or tenant termination for future and existing bookings.
12. Confirm custom domains, property-specific branded pages, tenant SEO controls, and localization are later-phase work.
13. Approve launch tenant count, active property count, expected inventory, peak traffic, support SLA, and recovery targets.
14. Confirm whether multi-hotel guest itinerary/cart should ever be a product goal; the initial scope excludes it.
15. Define the platform's rights and process for correcting inaccurate listing claims, user-submitted reviews, safety incidents, and disputes.

## 20. Risks and mitigations

| Risk | Impact | Mitigation / release gate |
|---|---|---|
| Tenant context is omitted from one data path | Cross-tenant disclosure or mutation | Table/API/job ownership inventory; deny-by-default authorization; adversarial cross-tenant tests; release-blocking gate. |
| Current global unique keys are changed without collision handling | Failed migration or broken URLs/data | Preflight duplicate report; staged, scoped constraints; stable public identifiers and redirect policy. |
| Booking ownership is inferred incorrectly from mutable room records | Historical reservation assigned to wrong hotel | Backfill from immutable allocations with reconciliation; halt on ambiguous data. |
| Existing first-hotel assumptions remain in pricing/search/settings | Wrong currency, tax, availability, or policy | Require selected `hotelId` in every guest/booking context; multi-property contract tests. |
| Payment model is undecided | Funds and refunds become operationally or legally unsafe | Block production marketplace payments until merchant/settlement model and reconciliation are approved. |
| Search price sorting compares unlike currencies | Misleading or unfair ranking | Disable mixed-currency numerical sort until conversion, labeling, and rate refresh are approved. |
| Tenant lifecycle is not tied to existing reservations | Guests left without a servicing property | Suspension/closure runbook and explicit reservation responsibility/transfer workflow. |
| Global amenity/promotion/content model is copied blindly | Tenants overwrite shared data or expose content | Explicit platform taxonomy vs tenant extension ownership and approval. |
| Unverified coordinates enter public map | Misleading location and potential safety/privacy harm | Verification state, publication gate, no synthetic production values, clearly labeled approximations if approved. |
| Platform support has unrestricted access | Insider privacy risk | Separate break-glass support permission, purpose, audit trail, review and alerting. |

## 21. Acceptance and readiness criteria

The product is ready to enter implementation planning when:

- marketplace vs tenant workspace scope and the initial customer/operator model are approved;
- organization/property ownership and actor roles are agreed;
- payment merchant/settlement responsibility and supported country/currency behavior are settled for the intended launch;
- the exact property and guest data-access policy is approved;
- listing verification, moderation, suspension, and offboarding policies are documented;
- the source-to-tenant data ownership inventory and single-hotel migration strategy are reviewed;
- MVP exclusions and measurable capacity/support targets are agreed;
- each requirement has an owner and test approach in the plan.

The product is ready for production launch only when:

- all P1 user journeys pass end-to-end for at least two independent tenants;
- no cross-tenant authorization violations are found in the release test matrix;
- existing Santo Hotel transactional data reconciles with no unexplained difference;
- availability, checkout, payment, cancellation, refund, and tenant suspension behavior is proven;
- tenant support, payment reconciliation, incident response, backup/restore, and data retention operations are staffed and tested.

## 22. Implementation handoff

Implementation planning should begin with a table-by-table and entry-point-by-entry-point tenancy assessment, not with a UI-only multi-hotel carousel. At minimum, assess:

- tenant organization, hotel/property, membership, role, and listing-publication concepts;
- ownership and authorization for rooms, room types, rates, images, amenities, promotions, bookings, allocations, payments, notifications, guest access, content, and audit logs;
- global uniqueness and URL stability;
- property-specific search, availability, pricing, timezone, currency, policy, tax, payment, and reservation snapshots;
- public catalog and listing pages, admin/staff APIs, reports, exports, webhook handlers, emails, caches, and scheduled jobs;
- safe Santo data migration, deterministic test fixtures with at least two tenants, and tenant-isolation quality gates.

Do not treat the current `Hotel` table or `hotelId` on `RoomType` alone as sufficient multi-tenancy. Do not change production payment routing, currency conversion, guest-data sharing, or property ownership-transfer behavior without the business approvals listed above.
