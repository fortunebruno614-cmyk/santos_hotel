/**
 * P4 availability flags — reversible defaults for open hotel policies
 * (docs/OPEN_QUESTIONS.md). None of these is a decision: flipping the env var
 * changes behaviour without a code change, and the question stays `open`.
 *
 *   ALLOW_SAME_DAY_TURNOVER   (#8, default true)
 *       true  -> stay windows are half-open `[check_in, check_out)`: a guest may
 *                arrive on another guest's departure date (standard hotel
 *                turnover). This is the overlap rule written in the P4 plan.
 *       false -> the departure date is also blocked for arrival; intervals are
 *                treated as closed `[check_in, check_out]`.
 *
 *   PENDING_HOLD_MINUTES      (new #20, default 60)
 *       An unpaid PENDING booking holds its room nights this long from
 *       `created_at`, then the allocation transaction releases them so
 *       abandoned checkouts cannot leak inventory forever.
 *
 *   CHILDREN_COUNT_AS_ADULTS  (#15, default false)
 *       false -> children are checked against `max_children` and adults against
 *                `max_adults`;
 *       true  -> children consume adult capacity too
 *                (`adults + children <= max_adults`).
 */

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const ALLOW_SAME_DAY_TURNOVER = process.env.ALLOW_SAME_DAY_TURNOVER !== "false";

export const PENDING_HOLD_MINUTES = positiveInt(process.env.PENDING_HOLD_MINUTES, 60);

export const CHILDREN_COUNT_AS_ADULTS = process.env.CHILDREN_COUNT_AS_ADULTS === "true";
