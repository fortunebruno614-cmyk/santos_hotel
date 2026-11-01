import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BOOKING_REFERENCE_YEAR_PREFIX } from "@/config/booking";

/**
 * P5 booking reference generator — `SH-YYYY-NNNNNN`
 * (docs/DEVELOPMENT_PLAN.md P5, format from P2: "separate customer-facing
 * booking_reference (e.g. SH-2026-000123) from PK").
 *
 * A database sequence reserves references atomically, avoiding the race in a
 * `MAX()` scan. The unique constraint remains the final collision guard and
 * `createBooking` retries a rejected reference.
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

/** Reserves the next reference number and formats it for the year of `now`. */
export async function nextBookingReference(client: Db = prisma, now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const rows = await client.$queryRaw<Array<{ sequence: bigint }>>`
    SELECT nextval('"booking_reference_seq"') AS "sequence"
  `;
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error("booking reference sequence returned no value");
  }
  return formatBookingReference(year, Number(sequence));
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
