import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CURRENCY, CHECK_IN_TIME, CHECK_OUT_TIME } from "@/config/booking";

/**
 * Hotel-scoped context for P5: money currency, timezone and the clock times
 * that anchor policies (cancellation deadline, check-in guards).
 *
 * The `hotels` row is the source of truth; `src/config/booking.ts` supplies the
 * fallbacks so a fresh database still quotes and guards correctly.
 */
export type HotelContext = {
  id: string | null;
  name: string;
  currency: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
};

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * `client` matters inside an interactive transaction: on a single-backend
 * database (PGlite) a second connection would deadlock against the open
 * transaction, and on Postgres it would simply be a wasted round-trip that
 * cannot see the transaction's own writes.
 */
export async function loadHotelContext(client: Db = prisma): Promise<HotelContext> {
  const hotel = await client.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  return {
    id: hotel?.id ?? null,
    name: hotel?.name ?? "Santo Hotel",
    currency: hotel?.currency || CURRENCY,
    timezone: hotel?.timezone || "Asia/Kuala_Lumpur",
    checkInTime: CHECK_IN_TIME,
    checkOutTime: CHECK_OUT_TIME,
  };
}

/**
 * "Today" as the hotel sees it: the calendar date in the hotel's timezone,
 * returned as the same UTC-midnight date-only value every `@db.Date` column
 * uses. Checked-in/out guards must not flip just because UTC already rolled
 * over while it is still yesterday at the front desk.
 */
export function hotelToday(now: Date, timezone: string): Date {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** UTC offset (ms) of `timeZone` at the instant `utcMs`. */
function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/**
 * The instant (UTC) at which `time` occurs on a given date-only day in
 * `timeZone` — used to place the cancellation deadline on the check-in date.
 * A second pass corrects the (rare) case where the first estimate landed on the
 * other side of a DST transition.
 */
export function zonedToUtc(date: Date, time: string, timeZone: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
  let instant = guess - timeZoneOffsetMs(guess, timeZone);
  const corrected = guess - timeZoneOffsetMs(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** Display helper: `MYR 450.00` using the hotel currency. */
export function formatMoney(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}
