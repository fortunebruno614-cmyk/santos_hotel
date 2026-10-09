import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BOOKING_REFERENCE_YEAR_PREFIX } from "@/config/booking";

/**
 * P5 booking reference generator — `SH-YYYY-NNNNNN`
 * (docs/DEVELOPMENT_PLAN.md P5, format from P2: "separate customer-facing
 * booking_reference (e.g. SH-2026-000123) from PK").
 *
 * The sequence restarts every calendar year and is derived from the highest
 * reference already stored for that year. That read is not a lock: two
 * checkouts racing for the same number resolve through the unique constraint on
 * `bookings.booking_reference` — the loser gets P2002 and the checkout retries
 * with the next number (see `createBooking`).
 */

type Db = Prisma.TransactionClient | typeof prisma;

export const BOOKING_REFERENCE_REGEX = /^SH-(\d{4})-(\d{6})$/;

export type ParsedBookingReference = { year: number; sequence: number };

export function formatBookingReference(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`invalid booking reference year: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) {
    throw new Error(`booking reference sequence out of range: ${sequence}`);
  }
  return `${BOOKING_REFERENCE_YEAR_PREFIX}-${year}-${String(sequence).padStart(6, "0")}`;
}

export function parseBookingReference(reference: string): ParsedBookingReference | null {
  const match = BOOKING_REFERENCE_REGEX.exec(reference);
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

/** Highest sequence used for `year` (0 when the year has no references yet). */
export async function currentSequence(client: Db, year: number): Promise<number> {
  const prefix = `${BOOKING_REFERENCE_YEAR_PREFIX}-${year}-%`;
  const rows = await client.$queryRaw<Array<{ seq: number | null }>>`
    SELECT MAX(CAST(RIGHT("booking_reference", 6) AS integer)) AS "seq"
    FROM "bookings"
    WHERE "booking_reference" LIKE ${prefix}
  `;
  return rows[0]?.seq ?? 0;
}

/** The next free reference for the year of `now` (does not reserve it). */
export async function nextBookingReference(client: Db = prisma, now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const sequence = await currentSequence(client, year);
  return formatBookingReference(year, sequence + 1);
}

/** True when a unique-constraint violation rejected *this* reference. */
export function isBookingReferenceConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    meta?: { target?: unknown; cause?: { originalMessage?: string } };
  };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  const original = e.meta?.cause?.originalMessage ?? "";
  return targetText.includes("booking_reference") || original.includes("booking_reference");
}
