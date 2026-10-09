import { Prisma } from "@/generated/prisma/client";

/**
 * P5 money model — one place where a decimal becomes a rounded currency amount.
 *
 * Every stored figure (`bookings.subtotal/taxes/fees/discount/total`,
 * `booking_rooms.nightly_rate/room_total`) is DECIMAL(10,2), so every step of a
 * quote rounds exactly once, half-up, to 2 places. Floats never touch money.
 */

export type Money = Prisma.Decimal;

const MONEY_SCALE = 2;

/** Rounds any numeric input to a 2-place currency amount (half-up). */
export function money(value: string | number | Money): Money {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return decimal.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

/** Parses a client-supplied money string ("450.00") into a Decimal, or null. */
export function parseMoney(value: string | null | undefined): Money | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) return null;
  return money(value.trim());
}

/** Canonical wire/JSON form: always two decimals, never scientific notation. */
export function moneyString(value: Money): string {
  return value.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export function moneyEquals(a: Money, b: Money): boolean {
  return money(a).equals(money(b));
}

export type MoneyBreakdown = {
  subtotal: Money;
  taxes: Money;
  fees: Money;
  discount: Money;
  total: Money;
};

export type PricingRoomLine = {
  roomId: string;
  nightlyRate: Money;
  roomTotal: Money;
};

export type PricingSnapshot = {
  breakdown: MoneyBreakdown;
  /** Per-room rate snapshot that becomes `booking_rooms`. */
  rooms: PricingRoomLine[];
  /** Promotion actually applied (null when no code was used or none qualified). */
  promotion: { id: string; code: string } | null;
};

/** The client-quoted price and the in-transaction price disagree. */
export class PriceChangedError extends Error {
  readonly expected: MoneyBreakdown;
  readonly actual: MoneyBreakdown;
  constructor(expected: MoneyBreakdown, actual: MoneyBreakdown) {
    super(
      `price changed during checkout: quoted ${moneyString(expected.total)}, recomputed ${moneyString(actual.total)}`,
    );
    this.name = "PriceChangedError";
    this.expected = expected;
    this.actual = actual;
  }
}

function breakdownEquals(a: MoneyBreakdown, b: MoneyBreakdown): boolean {
  return (
    moneyEquals(a.subtotal, b.subtotal) &&
    moneyEquals(a.taxes, b.taxes) &&
    moneyEquals(a.fees, b.fees) &&
    moneyEquals(a.discount, b.discount) &&
    moneyEquals(a.total, b.total)
  );
}

/**
 * Structural equality of two quotes of the same stay: identical totals *and*
 * identical per-room rate snapshots, regardless of promotion comparison (the
 * in-transaction recompute is expected to reach the same conclusion).
 */
export function snapshotsEqual(a: PricingSnapshot, b: PricingSnapshot): boolean {
  if (!breakdownEquals(a.breakdown, b.breakdown)) return false;
  if (a.rooms.length !== b.rooms.length) return false;
  const byId = new Map(b.rooms.map((line) => [line.roomId, line]));
  for (const line of a.rooms) {
    const other = byId.get(line.roomId);
    if (!other) return false;
    if (!moneyEquals(line.nightlyRate, other.nightlyRate)) return false;
    if (!moneyEquals(line.roomTotal, other.roomTotal)) return false;
  }
  return true;
}
