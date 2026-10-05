/**
 * P3 gate: authorization enforced on the backend, not just hidden in the UI.
 *
 *   Gate 1 — a Staff user cannot reach admin API routes / admin-only pages.
 *   Gate 2 — a Guest cannot read another guest's bookings.
 *
 * Also asserts: default-deny for unlisted API routes, session revocation after a
 * role change, ownership-scoped booking detail, login throttling and the audit
 * trail (login / failed login / permission change / access denied / logout).
 *
 * Usage:  npm run authz:fixtures   (once, seeds two guests with one booking each)
 *         npm run dev              (app must be running)
 *         npm run authz:check
 */

const BASE = process.env.APP_URL ?? "http://127.0.0.1:3000";

const STAFF_EMAIL = "staff@santohotel.test";
const STAFF_PASSWORD = "Staff123!";
const ADMIN_EMAIL = "admin@santohotel.test";
const ADMIN_PASSWORD = "Admin123!";
const GUEST_A_EMAIL = "guest@santohotel.test";
const GUEST_A_PASSWORD = "Guest123!";
const GUEST_B_EMAIL = "guest2@santohotel.test";
const GUEST_B_PASSWORD = "Guest123!";
const THROTTLE_EMAIL = "throttle@santohotel.test";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

type CallResult = {
  status: number;
  location: string | null;
  json: unknown;
  cookie: string | null;
};

async function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string | null } = {},
): Promise<CallResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    redirect: "manual",
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : (init.cookie ?? null);

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, location: res.headers.get("location"), json, cookie };
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function redirectsTo(res: CallResult, path: string) {
  return isRedirect(res.status) && (res.location ?? "").includes(path);
}

async function login(kind: "staff" | "guest", email: string, password: string) {
  const res = await call("/api/auth/login", {
    method: "POST",
    body: { kind, email, password },
  });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
  }
  return res.cookie;
}

function rows(json: unknown): Array<Record<string, unknown>> {
  return Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
}

function statusOf(res: CallResult) {
  return res.status;
}

async function main() {
  try {
    await fetch(`${BASE}/`, { redirect: "manual" });
  } catch {
    throw new Error(`App not reachable at ${BASE}. Start it first (npm run dev / npm run start).`);
  }

  // --- Public --------------------------------------------------------------
  const home = await call("/");
  record("public: home is reachable", home.status === 200, `status=${home.status}`);

  const rooms = await call("/api/public/rooms");
  record("public: room list API is open", rooms.status === 200, `status=${rooms.status}`);

  const loginPage = await call("/login");
  record("public: login page is reachable", loginPage.status === 200, `status=${loginPage.status}`);

  const signupPage = await call("/signup");
  record("public: signup page is reachable", signupPage.status === 200, `status=${signupPage.status}`);

  // --- Anonymous -----------------------------------------------------------
  const anonAdminPage = await call("/admin");
  record(
    "anonymous: /admin redirects to login",
    redirectsTo(anonAdminPage, "/login"),
    `status=${anonAdminPage.status} location=${anonAdminPage.location}`,
  );

  const anonAdminUsersPage = await call("/admin/users");
  record(
    "anonymous: /admin/users redirects to login",
    redirectsTo(anonAdminUsersPage, "/login"),
    `status=${anonAdminUsersPage.status} location=${anonAdminUsersPage.location}`,
  );

  const anonAccountPage = await call("/account");
  record(
    "anonymous: /account redirects to login",
    redirectsTo(anonAccountPage, "/login"),
    `status=${anonAccountPage.status} location=${anonAccountPage.location}`,
  );

  const anonAdminUsers = await call("/api/admin/users");
  record("anonymous: admin users API is 401", statusOf(anonAdminUsers) === 401, `status=${anonAdminUsers.status}`);

  const anonAdminAudit = await call("/api/admin/audit");
  record("anonymous: admin audit API is 401", statusOf(anonAdminAudit) === 401, `status=${anonAdminAudit.status}`);

  const anonStaff = await call("/api/staff/reservations");
  record("anonymous: staff API is 401", statusOf(anonStaff) === 401, `status=${anonStaff.status}`);

  const anonGuest = await call("/api/account/bookings");
  record("anonymous: guest API is 401", statusOf(anonGuest) === 401, `status=${anonGuest.status}`);

  const anonUnregistered = await call("/api/definitely-not-a-route");
  record(
    "anonymous: unlisted API route is 401 (default-deny)",
    statusOf(anonUnregistered) === 401,
    `status=${anonUnregistered.status}`,
  );

  // --- Staff ---------------------------------------------------------------
  const staffCookie = await login("staff", STAFF_EMAIL, STAFF_PASSWORD);

  const staffMe = await call("/api/auth/me", { cookie: staffCookie });
  record(
    "staff: session resolves to STAFF",
    staffMe.status === 200 && (staffMe.json as { role?: string }).role === "STAFF",
    `status=${staffMe.status} role=${(staffMe.json as { role?: string })?.role ?? "?"}`,
  );

  const staffReservations = await call("/api/staff/reservations", { cookie: staffCookie });
  record("staff: can read reservations", staffReservations.status === 200, `status=${staffReservations.status}`);

  const staffAdminUsers = await call("/api/admin/users", { cookie: staffCookie });
  record("GATE 1: staff blocked from admin users API", staffAdminUsers.status === 403, `status=${staffAdminUsers.status}`);

  const staffAdminAudit = await call("/api/admin/audit", { cookie: staffCookie });
  record("GATE 1: staff blocked from admin audit API", staffAdminAudit.status === 403, `status=${staffAdminAudit.status}`);

  const staffPatch = await call("/api/admin/users/not-a-real-id", {
    method: "PATCH",
    cookie: staffCookie,
    body: { role: "ADMIN" },
  });
  record("GATE 1: staff cannot change roles", staffPatch.status === 403, `status=${staffPatch.status}`);

  const staffOwnBookings = await call("/api/account/bookings", { cookie: staffCookie });
  record("staff: blocked from guest booking API", staffOwnBookings.status === 403, `status=${staffOwnBookings.status}`);

  const staffAdminPage = await call("/admin", { cookie: staffCookie });
  record("staff: can open /admin", staffAdminPage.status === 200, `status=${staffAdminPage.status}`);

  const staffUsersPage = await call("/admin/users", { cookie: staffCookie });
  record(
    "GATE 1: staff /admin/users goes to /unauthorized",
    redirectsTo(staffUsersPage, "/unauthorized"),
    `status=${staffUsersPage.status} location=${staffUsersPage.location}`,
  );

  const staffAccountPage = await call("/account", { cookie: staffCookie });
  record(
    "staff: /account goes to /unauthorized",
    redirectsTo(staffAccountPage, "/unauthorized"),
    `status=${staffAccountPage.status} location=${staffAccountPage.location}`,
  );

  const staffUnregistered = await call("/api/definitely-not-a-route", { cookie: staffCookie });
  record(
    "staff: unlisted API route is not anonymous",
    staffUnregistered.status === 404,
    `status=${staffUnregistered.status} (404 = proxy let a signed-in caller through to the router)`,
  );

  // --- Admin ---------------------------------------------------------------
  const adminCookie = await login("staff", ADMIN_EMAIL, ADMIN_PASSWORD);

  const adminUsers = await call("/api/admin/users", { cookie: adminCookie });
  record("admin: can read users", adminUsers.status === 200, `status=${adminUsers.status}`);

  const staffRow = rows(adminUsers.json).find((r) => r.email === STAFF_EMAIL);
  record("admin: staff account is listed", Boolean(staffRow), `found=${Boolean(staffRow)}`);

  if (staffRow) {
    const promote = await call(`/api/admin/users/${staffRow.id as string}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { role: "ADMIN" },
    });
    record("admin: can change a permission", promote.status === 200, `promote=${promote.status}`);

    // The promoted user's existing token still says STAFF while the database now
    // says ADMIN — the guard must reject it immediately, not in 7 days.
    const staleStaff = await call("/api/staff/reservations", { cookie: staffCookie });
    record(
      "GATE 1: role change invalidates the old session",
      promote.status === 200 && staleStaff.status === 401,
      `promote=${promote.status} stale_session=${staleStaff.status}`,
    );

    const demote = await call(`/api/admin/users/${staffRow.id as string}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { role: "STAFF" },
    });

    const restoredStaff = await call("/api/staff/reservations", { cookie: staffCookie });
    record(
      "staff: session valid again once roles match",
      demote.status === 200 && restoredStaff.status === 200,
      `demote=${demote.status} reservations=${restoredStaff.status}`,
    );
  } else {
    record("admin: can change a permission", false, "staff row missing from /api/admin/users");
  }

  const adminRow = rows(adminUsers.json).find((r) => r.email === ADMIN_EMAIL);
  const adminSelf = adminRow
    ? await call(`/api/admin/users/${adminRow.id as string}`, {
        method: "PATCH",
        cookie: adminCookie,
        body: { role: "STAFF" },
      })
    : null;
  record(
    "admin: cannot demote their own account",
    Boolean(adminSelf) && adminSelf!.status === 400,
    `status=${adminSelf?.status ?? "n/a (admin row not found)"}`,
  );

  // --- Guest A -------------------------------------------------------------
  const guestALogin = await call("/api/auth/login", {
    method: "POST",
    body: { kind: "guest", email: GUEST_A_EMAIL, password: GUEST_A_PASSWORD },
  });
  const guestACookie = guestALogin.cookie;
  record("guest: can sign in", guestALogin.status === 200, `status=${guestALogin.status}`);

  const guestAMe = await call("/api/auth/me", { cookie: guestACookie });
  record(
    "guest: session resolves to GUEST",
    guestAMe.status === 200 && (guestAMe.json as { role?: string }).role === "GUEST",
    `status=${guestAMe.status} role=${(guestAMe.json as { role?: string })?.role ?? "?"}`,
  );

  const guestAListRes = await call("/api/account/bookings", { cookie: guestACookie });
  const guestAList = rows(guestAListRes.json);
  record(
    "guest: can read own bookings",
    guestAList.length > 0,
    `count=${guestAList.length} (run: npm run authz:fixtures if 0)`,
  );

  // --- Guest B: sign-up path + isolation -----------------------------------
  const signupB = await call("/api/auth/signup", {
    method: "POST",
    body: {
      firstName: "Bobby",
      lastName: "Second",
      email: GUEST_B_EMAIL,
      password: GUEST_B_PASSWORD,
    },
  });
  let guestBCookie = signupB.cookie;
  if (signupB.status !== 201) {
    const loginB = await call("/api/auth/login", {
      method: "POST",
      body: { kind: "guest", email: GUEST_B_EMAIL, password: GUEST_B_PASSWORD },
    });
    guestBCookie = loginB.cookie;
    record("guest: second guest can sign in", loginB.status === 200, `signup=${signupB.status} login=${loginB.status}`);
  } else {
    record("guest: second guest can sign up", signupB.status === 201, `signup=${signupB.status}`);
  }

  const guestBListRes = await call("/api/account/bookings", { cookie: guestBCookie });
  const guestBList = rows(guestBListRes.json);
  const leakedIds = guestBList.filter((b) => guestAList.some((a) => a.id === b.id));
  const leakedRefs = guestBList.filter((b) =>
    guestAList.some((a) => a.bookingReference === b.bookingReference),
  );
  record(
    "guest B: has bookings of their own (fixture)",
    guestBList.length > 0,
    `count=${guestBList.length} (run: npm run authz:fixtures if 0)`,
  );
  record(
    "GATE 2: guest cannot read another guest's bookings (list)",
    guestBListRes.status === 200 && guestAList.length > 0 && leakedIds.length === 0 && leakedRefs.length === 0,
    `status=${guestBListRes.status} own=${guestBList.length} leaked=${leakedIds.length}`,
  );

  const guestADetail = guestAList[0]
    ? await call(`/api/account/bookings/${guestAList[0].id as string}`, { cookie: guestACookie })
    : null;
  record(
    "guest: can read own booking detail",
    Boolean(guestADetail) && guestADetail!.status === 200,
    `status=${guestADetail?.status ?? "n/a"}`,
  );

  const idorDetail = guestAList[0]
    ? await call(`/api/account/bookings/${guestAList[0].id as string}`, { cookie: guestBCookie })
    : null;
  record(
    "GATE 2: guest cannot read another guest's booking (detail)",
    Boolean(idorDetail) && idorDetail!.status === 404,
    `status=${idorDetail?.status ?? "n/a"} (404: not found *for this guest*, no existence leak)`,
  );

  const anonDetail = guestAList[0]
    ? await call(`/api/account/bookings/${guestAList[0].id as string}`)
    : null;
  record(
    "anonymous: booking detail is 401",
    Boolean(anonDetail) && anonDetail!.status === 401,
    `status=${anonDetail?.status ?? "n/a"}`,
  );

  const guestAdminUsers = await call("/api/admin/users", { cookie: guestBCookie });
  record("guest: blocked from admin API", guestAdminUsers.status === 403, `status=${guestAdminUsers.status}`);

  const guestStaff = await call("/api/staff/reservations", { cookie: guestBCookie });
  record("guest: blocked from staff API", guestStaff.status === 403, `status=${guestStaff.status}`);

  const guestAdminPage = await call("/admin", { cookie: guestBCookie });
  record(
    "guest: /admin goes to /unauthorized",
    redirectsTo(guestAdminPage, "/unauthorized"),
    `status=${guestAdminPage.status} location=${guestAdminPage.location}`,
  );

  const guestAccountPage = await call("/account", { cookie: guestBCookie });
  record("guest: can open /account", guestAccountPage.status === 200, `status=${guestAccountPage.status}`);

  const guestUnsafeNext = await call("/login?next=/admin", { cookie: guestBCookie });
  record(
    "guest: ?next= cannot smuggle a guest into /admin",
    redirectsTo(guestUnsafeNext, "/account"),
    `status=${guestUnsafeNext.status} location=${guestUnsafeNext.location}`,
  );

  // --- Tampering -----------------------------------------------------------
  const forged = await call("/api/auth/me", { cookie: "session=not-a-valid-jwt" });
  record("forged session cookie is rejected", forged.status === 401, `status=${forged.status}`);

  const wrongKind = await call("/api/auth/login", {
    method: "POST",
    body: { kind: "staff", email: GUEST_A_EMAIL, password: GUEST_A_PASSWORD },
  });
  record(
    "guest credentials cannot open a staff session",
    wrongKind.status === 401,
    `status=${wrongKind.status}`,
  );

  // --- Login throttling ----------------------------------------------------
  const attempts: number[] = [];
  for (let i = 0; i < 11; i++) {
    const res = await call("/api/auth/login", {
      method: "POST",
      body: { kind: "staff", email: THROTTLE_EMAIL, password: "WrongPassword1" },
    });
    attempts.push(res.status);
  }
  record(
    "brute force: 10 failures allowed, 11th is throttled",
    attempts.slice(0, 10).every((s) => s === 401) && attempts[10] === 429,
    `attempts=${attempts.join(",")}`,
  );

  const afterThrottle = await login("guest", GUEST_A_EMAIL, GUEST_A_PASSWORD);
  record(
    "brute force: throttle is scoped to the attacked identity",
    Boolean(afterThrottle),
    `guest sign-in still=${Boolean(afterThrottle)}`,
  );

  // --- Audit via admin API -------------------------------------------------
  const audit = await call("/api/admin/audit", { cookie: adminCookie });
  const auditRows = rows(audit.json);
  const has = (action: string, entityType?: string) =>
    auditRows.some(
      (r) => r.action === action && (entityType === undefined || r.entityType === entityType),
    );

  record("admin: audit log is readable", audit.status === 200, `status=${audit.status} rows=${auditRows.length}`);
  record("audit: staff login recorded", has("auth.login", "user"), `rows=${auditRows.length}`);
  record("audit: guest login recorded", has("auth.login", "guest"), `rows=${auditRows.length}`);
  record("audit: failed login recorded", has("auth.login_failed"), `rows=${auditRows.length}`);
  record("audit: permission change recorded", has("permission.change"), `rows=${auditRows.length}`);
  record("audit: access denied recorded", has("auth.access_denied"), `rows=${auditRows.length}`);

  // --- Logout --------------------------------------------------------------
  // A browser drops the cookie the server expires, so keep using the cookie
  // jar returned by the logout response (not the pre-logout token).
  const logoutRes = await call("/api/auth/logout", { method: "POST", cookie: adminCookie });
  const afterLogout = await call("/api/admin/users", { cookie: logoutRes.cookie });
  record("logout clears the session", afterLogout.status === 401, `status=${afterLogout.status}`);

  const adminAgain = await login("staff", ADMIN_EMAIL, ADMIN_PASSWORD);
  const auditAfterLogout = await call("/api/admin/audit", { cookie: adminAgain });
  record(
    "audit: logout recorded",
    rows(auditAfterLogout.json).some((r) => r.action === "auth.logout"),
    `rows=${rows(auditAfterLogout.json).length}`,
  );

  const failed = results.filter((r) => !r.ok);
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name} -- ${result.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} authorization checks passed.`);

  // Explicit exit: fetch keep-alive sockets otherwise hold the process open.
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Authorization check failed to run:", error);
  process.exit(1);
});
