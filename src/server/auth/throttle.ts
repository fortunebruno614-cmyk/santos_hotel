/**
 * Failed-login throttling (in-memory, per server process).
 *
 * Counts *failures* only — successful sign-ins never consume the budget — and is
 * keyed by ip+email so one attacker cannot lock other people out, plus a wider
 * per-ip cap as a spray guard. Attempts reset once the window elapses.
 *
 * This is a process-local defence suitable for a single-node deployment; a
 * multi-node deployment should move the counters to Redis/Postgres.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 5 * 60_000;
const MAX_PER_IP_AND_EMAIL = 10;
const MAX_PER_IP = 100;

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function remaining(key: string, limit: number, now: number): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) return limit;
  return Math.max(0, limit - bucket.count);
}

export function loginThrottleState(ip: string, email: string) {
  const now = Date.now();
  prune(now);
  const emailKey = `${ip}|${email}`;
  const ipKey = `${ip}|*`;
  const retryAfterSec = Math.ceil(
    Math.max(
      (buckets.get(emailKey)?.resetAt ?? now) - now,
      (buckets.get(ipKey)?.resetAt ?? now) - now,
    ) / 1000,
  );
  return {
    limited:
      remaining(emailKey, MAX_PER_IP_AND_EMAIL, now) === 0 ||
      remaining(ipKey, MAX_PER_IP, now) === 0,
    retryAfterSec: Math.max(retryAfterSec, 1),
    remaining: Math.min(
      remaining(emailKey, MAX_PER_IP_AND_EMAIL, now),
      remaining(ipKey, MAX_PER_IP, now),
    ),
  };
}

function hit(key: string, limit: number, now: number) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count = Math.min(bucket.count + 1, limit);
}

export function recordFailedLogin(ip: string, email: string) {
  const now = Date.now();
  prune(now);
  hit(`${ip}|${email}`, MAX_PER_IP_AND_EMAIL, now);
  hit(`${ip}|*`, MAX_PER_IP, now);
}

/** Called after a successful sign-in so a legitimate user is never left throttled. */
export function clearFailedLogins(ip: string, email: string) {
  buckets.delete(`${ip}|${email}`);
}

/** Test/diagnostic helper — drops all counters. */
export function resetLoginThrottle() {
  buckets.clear();
}
