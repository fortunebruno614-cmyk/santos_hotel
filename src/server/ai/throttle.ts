/**
 * Chat throttling (in-memory, per server process) — a cost and abuse guard
 * for the AI endpoint, in the same spirit as src/server/auth/throttle.ts:
 * keyed by ip, counting *messages* (not failures), resetting when the window
 * elapses. Deliberately generous enough for a real guest session and tight
 * enough that a script cannot run up an unattended Groq bill.
 *
 * Single-node only: a multi-node deployment should move the counter to
 * Redis/Postgres (documented alongside the login throttle).
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 5 * 60_000;
const MAX_PER_IP = 30;

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Records one message and reports whether the IP is over budget. */
export function hitChat(ip: string, now = Date.now()): { limited: boolean; retryAfterSec: number } {
  prune(now);
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSec: 0 };
  }
  bucket.count += 1;
  const limited = bucket.count > MAX_PER_IP;
  return {
    limited,
    retryAfterSec: limited ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0,
  };
}

/** Test/diagnostic helper — drops all counters. */
export function resetChatThrottle() {
  buckets.clear();
}
