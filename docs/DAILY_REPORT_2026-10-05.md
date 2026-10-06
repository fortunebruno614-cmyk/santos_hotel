# Daily Task Report — Santo Hotel

**Date:** Monday, 5 October 2026
**Scope:** Phase 3 — Authentication & Authorization (public vs protected areas enforced on the backend)
**Stack:** Next.js 16.3.8 (App Router, TS) · PostgreSQL (PGlite wire-protocol stand-in today) · Prisma 7.10.0 · `jose` JWT · Zod · Tailwind 4

---

## 1. Summary

| # | Task | Status |
| - | ---- | ------ |
| 1 | Recover + review in-progress P3 work in the working tree | Done — baseline gate 37/37 |
| 2 | Central access map (single source of truth for every route) | Done — `src/config/access-map.ts` |
| 3 | Proxy enforcement for pages **and** API (Next 16 `proxy.ts`) | Done — 307 redirects, 401/403 JSON |
| 4 | Handler-level guards + DB-backed session revocation | Done — `guardApi` / `require*` |
| 5 | Roles `ADMIN` / `STAFF` / `GUEST` + permission map | Done — enforced in server code |
| 6 | Guest area: profile + booking history, ownership-scoped detail | Done — 404, no existence leak |
| 7 | Audit log hooked into auth (login, permission change, …) | Done — 6 action types |
| 8 | Security hardening (throttle, password policy, JWT validation, `?next=`) | Done |
| 9 | Gate check expanded + verified on dev **and** production build | Done — **54/54** |
| 10 | Docs (README, setup, open questions, `.env.example`) | Done |
| 11 | Commit + push to `main` | Done — `4fba6e2` |

---

## 2. Architecture — two enforcing layers

```
request
  │
  ├─ src/proxy.ts  (Next 16 renamed middleware.ts → proxy.ts)
  │    JWT + access map → page: 307 /login?next=… or /unauthorized
  │                      API:   401 / 403 JSON (never a redirect)
  │    signed-in denials → audit row
  │
  └─ route handler / page
       guardApi()  /  requireAdmin|requireStaffOrAdmin|requireGuest()
       re-checks role + permission, then re-validates the principal in the DB
```

**Access map** (`src/config/access-map.ts`) — rules evaluated top-down, first match wins;
`evaluateAccess()` is shared by the proxy, the API guards and post-login redirects, so one
path can never mean two different things.

| Area | Paths | Access |
| ---- | ----- | ------ |
| Public | `/`, `/rooms`, `/search`, `/booking`, `/login`, `/signup`, `/unauthorized`, `/api/auth/*`, `/api/public/*` | anonymous |
| Guest | `/account/*`, `/api/account/*` | `GUEST` + own `guestId` only |
| Staff/Admin | `/admin/*`, `/api/staff/*` | `STAFF` or `ADMIN` |
| Admin only | `/admin/users`, `/api/admin/users*`, `/api/admin/audit` | `ADMIN` + `MANAGE_USERS` / `MANAGE_AUDIT` |
| Unlisted `/api/**` | — | **not anonymous** (needs a session) |

Defaults: unlisted *pages* are public (staff areas must live under `/admin`, guest areas
under `/account`); `/api/admin` and `/api/staff` are catch-alls, so a future admin endpoint
cannot be accidentally public. Adding a route = registering it in the map first.

---

## 3. Roles & permissions

`src/server/auth/roles.ts`

| Permission | STAFF | ADMIN |
| ---------- | ----- | ----- |
| MANAGE_ROOMS, MANAGE_RATES, MANAGE_RESERVATIONS, MANAGE_PAYMENTS, VIEW_REPORTS, VIEW_GUESTS, MANAGE_PROMOTIONS | ✅ | ✅ |
| MANAGE_USERS, MANAGE_AUDIT | — | ✅ |
| (guest) — no console permissions | — | — |

---

## 4. What was built

**Auth core** — `src/server/auth/`
- `session.ts` — HS256 JWT in an `httpOnly` `SameSite=Lax` cookie (7d); claim shape
  validated with Zod (staff ⇒ `userId`, guest ⇒ `guestId`); `SESSION_SECRET` **required in
  production** (refuses to sign/verify without it), documented dev fallback otherwise
- `crypto.ts` — scrypt + `timingSafeEqual`
- `service.ts` — staff/guest authentication, cookie set/clear, `lastLoginAt`
- `dal.ts` — `getCurrentSession`, `isSessionValid` (DB re-check: account still exists,
  active, role still matches), `requireAuth/requireGuest/requireStaffOrAdmin/requireAdmin`
- `api.ts` — `guardApi({ route, roles, permission })` → returns the session or a ready
  401/403; `guardGuestApi(route)`
- `roles.ts`, `actions.ts` (server actions), `validation.ts` (shared password/email
  schema), `throttle.ts`, `request.ts` (client IP)

**Routes / pages**
- `src/proxy.ts`, `src/config/access-map.ts`, `src/config/auth.ts`
- `/login`, `/signup`, `/unauthorized`, `/account` (profile + booking history),
  `/admin` (dashboard), `/admin/users` (admin-only, role editor)
- API: `auth/{login,signup,logout,me}`, `account/bookings`, `account/bookings/[id]`,
  `admin/users`, `admin/users/[id]`, `admin/audit`, `staff/reservations`, `public/rooms`

**Audit log** — `src/server/audit/write.ts` (writes never block the request)

| Action | Trigger |
| ------ | ------- |
| `auth.login` | staff or guest sign-in |
| `auth.login_failed` | bad credentials / throttled (with email + IP) |
| `auth.logout`, `auth.signup` | sign-out, guest registration |
| `permission.change` | admin changes a user's role (old → new) |
| `auth.access_denied` | signed-in principal denied by proxy or guard (route + reason) |

---

## 5. Hardening added today

1. **Session revocation** — role change / deactivation invalidates live tokens on the next
   request instead of after 7 days (proved by the gate).
2. **Login throttling** — 10 failures per 5 min per ip+email (429 + `Retry-After`), plus a
   100-per-IP spray cap; failures only, successful sign-ins never consume budget; in-memory
   (move to Redis/Postgres for multi-node).
3. **Password policy** — 8+ chars, letter + number, same schema on forms *and* endpoints;
   emails normalised (trim + lowercase).
4. **Booking detail ownership** — `/api/account/bookings/[id]` filters by
   `session.guestId` inside the query; another guest's booking is a `404`, not a `403`,
   so it can't be used to probe for existing reservations.
5. **`?next=` redirect safety** — must be a same-origin, non-API path *and* pass the access
   map for the resulting session (a guest cannot be smuggled into `/admin`).
6. **Admin self-demotion blocked** (400) — no locking the last administrator out.
7. **Expired-session loop fix** — revoked tokens land on `/login?expired=1`, which skips the
   "already signed in" bounce.
8. **Proxy runs on Node.js runtime by default in Next 16** — denial auditing is written from
   the layer that actually rejects the request.

---

## 6. Verification evidence

| Check | Result |
| ----- | ------ |
| `npm run lint` | **0 problems** |
| `npm run typecheck` (`next typegen && tsc --noEmit`) | Pass |
| `npm run build` (production) | Pass — proxy bundled, all routes compiled |
| `npm run authz:check` vs `npm run dev` | **54/54 passed** |
| `npm run authz:check` vs `next start` (prod, port 3001) | **54/54 passed** |

**Gate (the two required proofs)**

- **Gate 1 — Staff cannot hit admin API routes:** `403` on `/api/admin/users`,
  `/api/admin/audit`, `PATCH /api/admin/users/:id`; `/admin/users` → `/unauthorized`;
  plus a role change invalidates the staff session immediately (`401`), and restores it
  once roles match again.
- **Gate 2 — Guest cannot read another guest's bookings:** both guests own a booking;
  lists are disjoint (0 shared ids/refs); fetching the other guest's booking detail → `404`;
  anonymous → `401`.

Other checks: public pages/API open · anonymous → `/login?next=…` and `401` · guest blocked
from admin/staff APIs · unlisted API route `401` when anonymous · forged cookie rejected ·
guest credentials can't open a staff session · 10 bad logins then `429`, while a different
identity can still sign in · audit rows present for login, failed login, permission change,
access denied, logout · logout clears the session.

Gate script: `scripts/p3-authz-check.ts` (54 assertions) · fixtures:
`scripts/p3-authz-fixtures.ts` (two guests, one booking each).

---

## 7. Environment note (this machine)

No Docker/Postgres binaries available, so the committed Docker `.env` couldn't be used as-is.

- Added a **PGlite wire-protocol server** (already in `package.json`) on `127.0.0.1:5432`,
  data in `.pglite-data/` (git-ignored): `npx pglite-server -d ./.pglite-data -p 5432 -m 10`
- `.env.local` (git-ignored) — `DATABASE_URL` with `sslmode=disable` (PGlite speaks the wire
  protocol, not TLS) + a local `SESSION_SECRET`
- All 9 migrations applied and seeded on top of it; `.gitignore` updated for `.pglite-data/`

---

## 8. Docs updated

- `README.md` — P3 marked done, gate command, next phase
- `docs/setup.md` — real login credentials table (admin/staff/guest), `authz:*` scripts,
  verification sequence
- `docs/OPEN_QUESTIONS.md` — #13, #17, #18 answered with **reversible P3 defaults** (status
  stays `open`): guest accounts optional via `GUEST_ACCOUNTS_ENABLED` /
  `GUEST_BOOKING_REQUIRES_ACCOUNT`; `STAFF`/`ADMIN` hold `MANAGE_RESERVATIONS` + `MANAGE_RATES`
- `.env.example` — `SESSION_SECRET` (required in production) + guest-account flags
- New: `docs/DAILY_REPORT_2026-10-05.md` (this file)

---

## 9. Git state

- Committed + pushed: **`4fba6e2`** — *P3: authentication & authorization with an enforced
  access map and audit log* (49 files, +2858 / −50) → `origin/main`
  - Includes the leftover P2.3 composite index migration + `npm run db:indexes`, which were
    still uncommitted in the tree
- Working tree: **clean**
- Not touched: `.env.local`, `.pglite-data/` (both git-ignored), no secrets in the diff

---

## 10. Open items / next steps

1. **P4 — Availability Engine** (overlap detection, exclusion of maintenance/OOS rooms,
   concurrent-booking gate). Needs `OPEN_QUESTIONS.md` #7/#8 (check-in/out times, same-day
   turnover) before back-to-back rules are finalised.
2. **P5 booking flow** reads `GUEST_BOOKING_REQUIRES_ACCOUNT` once checkout exists (#13).
3. Throttle counters are per-process — move to a shared store before multi-node deployment.
4. Audit retention/rotation and `auth.access_denied` noise tuning are P8 scope.
5. Confirm hotel policies (currency, taxes, cancellation, gateway) before P6.
