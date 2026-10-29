# Multi-Tenant Hotel Listings MRD — Review Checklist

Use this checklist to review [MRD_MULTI_TENANT_HOTEL_LISTINGS.md](./MRD_MULTI_TENANT_HOTEL_LISTINGS.md) before generating an implementation plan.

## Product scope and outcomes

- [ ] Marketplace vs. tenant-only SaaS positioning is approved.
- [ ] MVP scope and explicit non-goals are understood by product, operations, finance, and engineering.
- [ ] User roles cover guest, hotel owner, hotel manager/staff, marketplace operations, and platform administrator.
- [ ] Public listing lifecycle and publication authority are approved.
- [ ] Guest discovery, booking, tenant operations, moderation, and Santo migration journeys are independently testable.

## Requirement quality

- [ ] All functional requirements use unique sequential `REQ-XXX` IDs.
- [ ] Every requirement is observable and has a test approach.
- [ ] P1 requirements cover property discovery, single-property booking, tenant onboarding, tenant isolation, platform governance, and Santo continuity.
- [ ] Requirements explicitly distinguish organization, hotel, room type, physical room, guest, and booking ownership.
- [ ] Requirements cover direct-ID/API access, background jobs, webhooks, caches, exports, and notifications—not only visible UI routes.
- [ ] Success measures are user/business outcomes and include performance, trust/safety, migration, and conversion guardrails.
- [ ] Edge cases cover status transitions, duplicate identifiers, multi-membership, property suspension, currency, and historical bookings.

## Security, privacy, and financial policy

- [ ] Tenant-private data is explicitly separated from intentional marketplace-wide identity.
- [ ] Hotel tenant access to guest PII is reservation-scoped and approved.
- [ ] Platform support access is distinct, purpose-bound, and audited.
- [ ] Merchant of record, payment settlement, refund/dispute ownership, and tenant financial reporting are approved before live multi-tenant checkout.
- [ ] Supported countries, currencies, taxes, and cross-currency display policy are approved.
- [ ] Data retention, guest deletion, tenant offboarding, and property ownership transfer policy are approved.
- [ ] Location verification, map visibility, approximate locations, and synthetic test-data handling are approved.

## Migration and operations

- [ ] Existing Santo Hotel is explicitly the first tenant/property.
- [ ] Existing bookings, payments, references, allocations, user access, and financial snapshots have reconciliation criteria.
- [ ] Global-to-tenant uniqueness changes include a preflight conflict report and URL behavior.
- [ ] Migration backup, recovery, rollback/roll-forward, and release gates are defined.
- [ ] Tenant suspension preserves the correct servicing path for existing confirmed reservations.
- [ ] Initial tenant/property/traffic targets and support SLA are approved.
- [ ] At least two-tenant integration and adversarial isolation tests are planned.

## Open decisions to resolve

- [ ] Commercial model: commission, subscription, per-booking fee, or other.
- [ ] Payment collection and settlement model.
- [ ] Launch geography and legal entity.
- [ ] Currency comparison and conversion policy.
- [ ] Tenant verification and listing review standards.
- [ ] Guest support ownership and data access.
- [ ] Tenant promotion rules.
- [ ] Tenant-specific domains/white-label scope.
- [ ] Property sale, closure, or ownership-transfer process.

## Readiness

- [ ] Product/business owners approve the marketplace position and MVP.
- [ ] Operations/legal/finance approve the policies that affect publication and bookings.
- [ ] Security/privacy approve the access and data-handling boundaries.
- [ ] Engineering validates the source-to-tenant ownership assessment.
- [ ] The MRD is ready to become a feature specification and implementation plan.
