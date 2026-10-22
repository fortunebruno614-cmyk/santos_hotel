import "./load-env";

/**
 * Dev route warm-up.
 *
 *   npm run warm          (with `npm run dev` already running)
 *
 * Turbopack compiles a route on its first request, so the first click through
 * booking → payment can take minutes on a cold cache. This walks the public
 * surface once after startup so those clicks are already compiled. It is
 * side-effect free: pages are read-only GETs and every POST probe sends an
 * invalid body, which compiles the handler and is rejected by zod before any
 * booking, payment or guest row is written.
 */

const BASE = process.env.WARM_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

const ROOM_ID = process.env.WARM_ROOM_ID ?? "2c48b050-6b14-4e6e-aaf7-92911f850e91";

const PAGES = [
  "/",
  "/rooms",
  "/rooms/deluxe-king",
  "/rooms/executive-suite",
  "/rooms/family-room",
  "/search?checkIn=2026-11-25&checkOut=2026-11-27&adults=2&children=0&rooms=1",
  "/booking",
  `/booking?checkIn=2026-11-25&checkOut=2026-11-27&adults=2&children=0&roomIds=${ROOM_ID}`,
  "/booking/confirmation",
  "/pay/SH-000000",
  "/login",
  "/signup",
  "/account",
  "/offers",
  "/hotel",
  "/contact",
  "/unauthorized",
  "/admin",
];

const GETS = [
  "/api/public/rooms",
  `/api/public/availability?checkIn=2026-11-25&checkOut=2026-11-27&adults=2&children=0&rooms=1`,
  `/api/public/quote?checkIn=2026-11-25&checkOut=2026-11-27&adults=2&children=0&rooms=${ROOM_ID}`,
];

const POSTS = [
  "/api/public/checkout",
  "/api/public/payments/initiate",
  "/api/public/payments/mock/complete",
  "/api/public/payments/webhook",
  "/api/public/bookings/SH-000000/cancel",
];

type Result = { target: string; status: number | string; ms: number };

async function probe(
  target: string,
  init?: RequestInit,
): Promise<Result> {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${target}`, init);
    return { target, status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { target, status: error instanceof Error ? error.message : "error", ms: Date.now() - started };
  }
}

async function waitForServer(timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/`, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function main() {
  const ready = await waitForServer();
  if (!ready) {
    console.error(`warm: no server answering at ${BASE} after 180s`);
    process.exitCode = 1;
    return;
  }

  const results: Result[] = [];
  for (const path of PAGES) results.push(await probe(path));
  for (const path of GETS) results.push(await probe(path));
  for (const path of POSTS) {
    results.push(
      await probe(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
  }

  for (const result of results) {
    console.log(`${String(result.status).padEnd(4)} ${String(result.ms).padStart(6)}ms  ${result.target}`);
  }

  const failed = results.filter((result) => result.status === "error");
  const slowest = results.reduce((worst, result) => (result.ms > worst.ms ? result : worst));
  console.log(
    `warm: ${results.length} routes, ${failed.length} unreachable, slowest ${slowest.ms}ms (${slowest.target})`,
  );
}

main().catch((error) => {
  console.error("warm failed:", error);
  process.exitCode = 1;
});
