/**
 * Per-IP throttle for the public flight endpoint.
 *
 * This protects the OpenSky credit budget from a visitor (or an abusive
 * client) hammering refresh. It is process-local, like the login throttle:
 * a multi-node deployment should move the counters to Redis/Postgres.
 * Cached upstream responses mean most allowed requests never touch OpenSky.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_KEYS = 2_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkFlightRateLimit(ip: string) {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
