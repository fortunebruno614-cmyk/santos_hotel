/**
 * P5 booking & checkout flags — reversible defaults for the open hotel policies
 * in docs/OPEN_QUESTIONS.md. Nothing here is a decision: every value is an env
 * var, so the hotel can change its mind without a code change, and the question
 * stays `open` until it is answered.
 *
 *   HOTEL_CURRENCY            (#1, default "MYR")
 *       Fallback currency used only when the `hotels` row has none.
 *
 *   TAX_RATE_PERCENT          (#2, default 0)
 *       Percentage applied to the discounted room subtotal. 0 = no tax until
 *       the hotel answers "are taxes included in displayed prices?".
 *
 *   SERVICE_FEE               (#3, default 0)
 *       Flat fee charged once per booking. 0 = no service fee.
 *
 *   CHECK_IN_TIME             (#7, default "15:00")
 *   CHECK_OUT_TIME            (#7, default "11:00")
 *       Displayed to guests and used to anchor the cancellation deadline on
 *       the check-in date. The availability engine itself never sees clock
 *       times (docs/OPEN_QUESTIONS.md #7).
 *
 *   CANCELLATION_WINDOW_HOURS (#9, default 48)
 *       Guests may cancel free of charge until this many hours before
 *       check-in. 0 = up to the moment of check-in.
 *
 *   GUEST_CANCELLATION_ENABLED (#9, default true)
 *       false -> only staff may cancel; the guest-facing cancel button and
 *       endpoint report `guest_cancellation_disabled`.
 *
 *   MAX_ROOMS_PER_BOOKING     (#14, default 10)
 *       Technical guard on how many physical rooms one reservation may hold.
 */

function envString(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value : fallback;
}

function envNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** `HH:MM` 24h clock; anything else falls back to the documented default. */
function envClock(raw: string | undefined, fallback: string): string {
  const value = envString(raw, fallback);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export const CURRENCY = envString(process.env.HOTEL_CURRENCY, "MYR").toUpperCase();

export const TAX_RATE_PERCENT = envNumber(process.env.TAX_RATE_PERCENT, 0, 0, 100);

export const SERVICE_FEE = envNumber(process.env.SERVICE_FEE, 0, 0, 1_000_000);

export const CHECK_IN_TIME = envClock(process.env.CHECK_IN_TIME, "15:00");

export const CHECK_OUT_TIME = envClock(process.env.CHECK_OUT_TIME, "11:00");

export const CANCELLATION_WINDOW_HOURS = envInt(process.env.CANCELLATION_WINDOW_HOURS, 48, 0, 8760);

export const GUEST_CANCELLATION_ENABLED = process.env.GUEST_CANCELLATION_ENABLED !== "false";

export const MAX_ROOMS_PER_BOOKING = envInt(process.env.MAX_ROOMS_PER_BOOKING, 10, 1, 50);

/** `SH-YYYY-NNNNNN` — the customer-facing reference format (docs/DEVELOPMENT_PLAN.md P5). */
export const BOOKING_REFERENCE_YEAR_PREFIX = "SH";

/** How often checkout re-rolls a reference after a unique-constraint race. */
export const BOOKING_REFERENCE_ATTEMPTS = 5;
