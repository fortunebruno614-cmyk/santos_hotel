/**
 * Pure date arithmetic for the availability engine — no I/O, no Prisma, so the
 * overlap rule is unit-testable on its own (tests/availability/overlap.test.ts).
 *
 * All dates are date-only (UTC midnight), matching the `@db.Date` columns of
 * `bookings.check_in/check_out` and `room_nights.night`.
 */

const MS_PER_DAY = 86_400_000;

export type StayWindow = { checkIn: Date; checkOut: Date };

/** Truncates any time-of-day to UTC midnight — the canonical representation. */
export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Parses `YYYY-MM-DD` as UTC midnight. Returns null when not a real calendar date. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null; // 2026-02-30 and friends
  }
  return date;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole nights between two date-only values (check_out exclusive). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Nights charged for a stay: one per night slept, checkout day not counted. */
export function nightsCount(checkIn: Date, checkOut: Date): number {
  return daysBetween(checkIn, checkOut);
}

/**
 * Calendar nights a booking holds inventory for — the rows written to
 * `room_nights`. Half-open `[check_in, check_out)` by default, which is what
 * makes same-day turnover legal. With `ALLOW_SAME_DAY_TURNOVER=false` the
 * checkout date is held too, so nobody can arrive on the departure date.
 *
 * Charged nights (`nightsCount`) never change: blocking a date is not billing it.
 */
export function expandNights(
  checkIn: Date,
  checkOut: Date,
  allowSameDayTurnover: boolean,
): Date[] {
  const nights: Date[] = [];
  const end = allowSameDayTurnover ? checkOut : addDays(checkOut, 1);
  for (let night = checkIn; night.getTime() < end.getTime(); night = addDays(night, 1)) {
    nights.push(night);
  }
  return nights;
}

/**
 * The P4 overlap rule (docs/DEVELOPMENT_PLAN.md):
 *
 *   allowSameDayTurnover:  existing.check_in  <  requested.check_out
 *                       AND existing.check_out  >  requested.check_in
 *   (half-open intervals — back-to-back stays never collide)
 *
 *   !allowSameDayTurnover: existing.check_in  <= requested.check_out
 *                       AND existing.check_out >= requested.check_in
 *   (closed intervals — a departure date is unavailable for arrival)
 *
 * Equivalent by construction to intersecting the `expandNights()` sets of both
 * windows, so the search query and the `room_nights` constraint can never
 * disagree about the same pair of stays.
 */
export function intervalsOverlap(
  a: StayWindow,
  b: StayWindow,
  allowSameDayTurnover: boolean,
): boolean {
  if (allowSameDayTurnover) {
    return a.checkIn.getTime() < b.checkOut.getTime() && b.checkIn.getTime() < a.checkOut.getTime();
  }
  return a.checkIn.getTime() <= b.checkOut.getTime() && b.checkIn.getTime() <= a.checkOut.getTime();
}
