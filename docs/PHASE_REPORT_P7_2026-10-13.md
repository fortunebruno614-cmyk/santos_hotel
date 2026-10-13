# Phase Delivery Report — P7 Staff/Admin Console

**Project:** Santo Hotel booking system
**Phase:** P7 — Staff/Admin Console
**Delivered:** Tuesday, 13 October 2026
**Commit:** this delivery (see `git log`)
**Gate status:** PASSED — `npm test` 95/95 · `npm run lint` 0 · `npm run typecheck` 0

---

## 1. What this phase delivered

The hotel can now run a full week of front-desk operations from the browser
only — no direct database access. Every module talks to the same service
layer the API routes and tests exercise, and every mutation lands an
`AuditLog` row.

| Capability | Where it lives |
| ---------- | -------------- |
| Morning dashboard: arrivals, departures, in-house, occupancy, revenue | `/admin` |
| Reservation search (reference / status / guest / room) + detail actions | `/admin/bookings`, `/admin/bookings/[id]` |
| Inventory board + physical-room CRUD | `/admin/rooms` |
| Room types, amenities, rates, promotions CRUD | `/admin/{room-types,amenities,rates,promotions}` |
| Guest records: search, detail, contact edits | `/admin/guests`, `/admin/guests/[id]` |
| Payment ledger with booking correlation + refunds | `/admin/payments` |
| User & permission management | `/admin/users` (admin only) |
| System settings (times, tax, currency, fees, cancellation window) | `/admin/settings` (admin only) |
| Website content slots with defaults and reset | `/admin/content` (admin only) → rendered on the public site |
| Audit trail with filters and pagination | `/admin/audit` (admin only) |

The nav is permission-aware: staff see operations modules; **Users, Settings,
Content and Audit appear for admins only** (`Permissions.MANAGE_USERS` gate
in `src/app/admin/layout.tsx`).

---

## 2. The guarantees (why operations can trust the console)

1. **The backend enforces every rule — the UI is a thin client.** All guards
   live in `src/server/console/*` and the P5/P6 services: the same checks a
   malicious or stale browser would have to bypass.
2. **Every mutating admin action writes an `AuditLog`** with action, entity
   type/id and old → new values: catalog create/update/delete, settings
   patches, content edits, user create/update/`permission.change`/delete,
   guest updates, reservations and money (`payment.*`, `booking.*`).
3. **Permission-gated by the P3 map.** Staff hold `MANAGE_ROOMS`,
   `MANAGE_RATES`, `MANAGE_PROMOTIONS`, `MANAGE_RESERVATIONS`,
   `MANAGE_PAYMENTS`; only admins hold `MANAGE_USERS`, `MANAGE_AUDIT`,
   `MANAGE_SETTINGS`, `MANAGE_CONTENT`.
4. **The reservation lifecycle never forks.** Check-in/out, transitions and
   notes go through the P5 services — the console inherits the transition
   table, the arrival-date check-in rule (hotel timezone) and cancellation
   windows unchanged.
5. **Money never forks either.** Desk capture, online intents and full/partial
   refunds are the P6 endpoints; the ledger is a read model over `Payment`.
6. **User management safety rails:** you cannot demote or deactivate
   yourself, cannot delete yourself, and the last active admin cannot be
   demoted or removed. Deactivating an account blocks sign-in immediately.
7. **Settings are validated at the wire boundary** (`SettingsPatchSchema`
   rejects out-of-range tax/fee/window values client- and server-side) and
   pricing/policy readers now read the hotel row **per request** — a settings
   save takes effect on the next search, no restart.
8. **Unique conflicts are application errors, not SQL errors** (see §3):
   duplicate room-type name/slug, room number, amenity name and promotion
   code all answer `409 conflict` from a pre-check, with the unique index
   retained as the race backstop.

---

## 3. Development note — the local PGlite database (important for future work)

The dev database is a PGlite wire server (`127.0.0.1:5432`), not Docker
Postgres. Two things were root-caused during this phase:

1. **Any SQL-level error on the extended (parameterized) protocol poisons the
   connection** — silent wrong results (e.g. a `findUnique` returning `null`
   for an existing row), `Received unexpected parseComplete message`, or a
   dropped connection. Simple-protocol queries handle errors fine.
2. Therefore P7 catalog services **pre-check uniqueness in application code**
   (`findUnique`/`findFirst` → `throw new ConsoleError("conflict")`) *before*
   any INSERT/UPDATE that could violate a unique index. The `isUniqueViolation`
   catch blocks remain as a defensive backstop, and the constraints remain in
   the schema as the race backstop.

Dev tooling was upgraded accordingly: `@electric-sql/pglite@0.5.9` +
`@electric-sql/pglite-socket@0.2.12` (devDependencies) — the server now
survives client-side protocol errors instead of crashing — and the local
database was recreated (`prisma migrate deploy`, all 11 migrations,
`npm run db:seed`). `prisma migrate dev` still cannot run against PGlite
(shadow-database limitation); write migration SQL by hand and
`npx prisma migrate deploy`.

**Rule of thumb for new code:** don't let SQL errors reach Prisma in
dev-critical paths — pre-check the condition or use app-level guards.

---

## 4. Configuration & content slots

No new environment variables. Website content lives in the new `site_content`
table (`key`, `title`, `body`, `updated_by`) with these slots (editable at
`/admin/content`, `DELETE` resets to the built-in default):

| Slot | Rendered on |
| ---- | ----------- |
| `home.hero` | `/` hero section |
| `rooms.intro` | `/rooms` intro |
| `site.footer` | footer of both public pages (`src/components/site-footer.tsx`) |

Settings written by `/admin/settings` are columns on the existing `Hotel`
row (check-in/out times, tax rate, service fee, currency, timezone,
cancellation window, guest-cancellation flag, max rooms per booking).

---

## 5. API surface

| Route | Method | Who | Does |
| ----- | ------ | --- | ---- |
| `/api/admin/room-types` · `/api/admin/rooms` · `/api/admin/amenities` · `/api/admin/rates` · `/api/admin/promotions` | GET, POST | staff+ (`MANAGE_ROOMS`/`MANAGE_RATES`/`MANAGE_PROMOTIONS`) | list & create |
| same, `/{id}` | PATCH, DELETE | staff+ | update & delete (in-use / transition guards) |
| `/api/admin/settings` | GET, PATCH | admin (`MANAGE_SETTINGS`) | read & partial-update hotel settings |
| `/api/admin/content` | GET, POST | admin (`MANAGE_CONTENT`) | list slots & upsert |
| `/api/admin/content/{key}` | DELETE | admin | reset a slot to its default |
| `/api/admin/guests` · `/{id}` | GET, POST / GET, PATCH | staff+ | guest search & contact edits |
| `/api/admin/users` · `/{id}` | GET, POST / PATCH, DELETE | admin (`MANAGE_USERS`) | account lifecycle (self/last-admin guards) |
| `/api/admin/audit` | GET | admin (`MANAGE_AUDIT`) | filtered, paginated audit trail |
| `/api/staff/bookings` | GET, POST | staff+ | reservation search (shared service) & staff walk-in create |
| `/api/staff/payments` | GET, POST | staff+ (`MANAGE_PAYMENTS`) | ledger search (shared service) & desk capture/intent |
| `/api/staff/payments/{id}/refund` | POST | staff+ | full/partial refund (P6) |

Server-rendered pages read Prisma through `src/server/console/*` directly;
client components call the JSON routes above and reload.

---

## 6. Test matrix (20 new tests, full suite 95/95)

| Suite | Scenarios |
| ----- | --------- |
| **P7 catalog CRUD** (7) | amenity CRUD + audit rows; duplicate name → `conflict`; room type CRUD, in-use delete guard; housekeeping transition table; delete room with reservation history → `in_use`; seasonal rates; promotions with redeemed-code guard |
| **P7 settings & content** (3) | partial settings patch with old → new audit; out-of-range rejected at `SettingsPatchSchema`; content upsert + reset-to-default |
| **P7 users & permissions** (4) | create/rename/delete with audit; duplicate e-mail → `conflict`; self-demotion, self-deletion and last-admin refused; deactivated account cannot sign in |
| **P7 guests, reservations & payments** (4) | guest contact update + audit; booking search by reference/status/room number; empty result page; payment ledger with booking correlation |
| **P7 dashboard** (1) | arrivals/departures/occupancy computed from live tables |
| **P7 week of simulated operations** (1) | quote → book → dashboard arrivals → confirm → desk capture → check-in → check-out → refund → guest detail → audit-trail assertions, entirely through the services the UI calls |

Fixtures are self-contained: own rooms (`P7…` numbers), guests
(`%@p7.test`) and an own inventory line, cleaned up in `after` — no
dependence on leftover seed rows.

---

## 7. Deliberately out of scope

- **Reports & notifications (P8)** — occupancy/revenue reports, e-mail
  channels; the dashboard is operational, not analytical.
- **Audit export** — the trail is filterable and paginated; CSV export lands
  with P8's export work.
- **Image/file uploads for content** — slots are text; if the hotel wants a
  CMS-style media library, `DB_AND_STORAGE.md` already points at
  object storage (S3/Supabase).
- **Bulk operations** (multi-room rate edits, batch status changes) — single
  entity flows cover the week's operations; add on demand.
- **Hard delete of guests with history** — guests with reservations are
  edited, not deleted (referential integrity is the guard).

---

## 8. How to verify this phase yourself

```bash
npx prisma migrate deploy && npm run db:seed   # once (or npm run db:migrate outside PGlite)
npm test                                       # 95/95 including tests/admin/
npm run lint && npm run typecheck
```

Manual walkthrough (dev server, sign in as `admin@…`):

1. `/admin` — the morning dashboard: arrivals, departures, occupancy.
2. `/admin/room-types` — create a type, edit it, try deleting one that has
   rooms → `in use`.
3. `/admin/rates` — add a seasonal rate; `/admin/promotions` — add a code.
4. `/admin/bookings` — search by reference/status/room; open a reservation,
   check in / check out, add a note.
5. `/admin/payments` — filter the ledger, refund a captured payment.
6. `/admin/users` — create a staff account, change a role (watch the
   `permission.change` audit row), try demoting yourself → refused.
7. `/admin/settings` — change the cancellation window; `/admin/content` —
   edit the home hero; view `/` to see it live; reset it back.
8. `/admin/audit` — every action above appears with old → new values.

---

## 9. Files delivered

| Area | Files |
| ---- | ----- |
| Migration | `prisma/migrations/20261013120000_p7_console/` (Hotel settings columns + `SiteContent`), `prisma/schema.prisma` |
| Console services | `src/server/console/{catalog,settings,users,guests,bookings,payments,audit,dashboard,errors,validation}.ts` |
| Admin API | `api/admin/{room-types,rooms,amenities,rates,promotions,settings,content,guests,users,audit}/` (+ `[id]`/`[key]` routes), refactored `api/staff/{bookings,payments}` onto shared search services |
| Admin UI | `app/admin/` — layout with permission-aware nav, dashboard, bookings (+detail/new), rooms inventory, room-types, amenities, rates, promotions, guests (+detail), payments + refund, users manager, settings form, content editor, audit page |
| Public wiring | `app/page.tsx`, `app/rooms/page.tsx`, `src/components/site-footer.tsx` (content slots) |
| Integration | `src/server/pricing/{context,service}.ts` (settings from DB), `src/server/booking/{service,validation,policy}.ts`, `src/server/auth/roles.ts`, `src/config/access-map.ts`, `src/server/audit/write.ts` |
| Tests | `tests/admin/console.test.ts` (20 tests) |
| Dev tooling | `package.json` — `@electric-sql/pglite@0.5.9`, `@electric-sql/pglite-socket@0.2.12` |
| Docs | `docs/DEVELOPMENT_PLAN.md` (P7 checked), this report |

---

## 10. Next phase

**P8 — Notifications, Audit & Reports**: booking confirmation/cancellation
e-mails (open question — channel), an audit-coverage review across all
admin/staff mutations (the trail is in place from P7), and the reporting
suite (occupancy, revenue by period, status breakdown) with pagination,
date-range filters and export.
