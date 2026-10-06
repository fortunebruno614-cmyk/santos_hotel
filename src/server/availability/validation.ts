import { z } from "zod";
import { nightsCount, parseDateOnly } from "@/server/availability/overlap";

/**
 * Wire-level validation for availability search (public API) — the same rules
 * apply to every entry point, so the service behind it can assume well-formed
 * input and still re-check invariants defensively.
 */

/** Technical guard so a stray query cannot ask for an unbounded scan — not a hotel policy. */
export const MAX_STAY_NIGHTS = 60;

export const DateOnlySchema = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, "expected a real calendar date as YYYY-MM-DD");

export const StaySearchSchema = z
  .object({
    checkIn: DateOnlySchema,
    checkOut: DateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20).default(1),
    children: z.coerce.number().int().min(0).max(20).default(0),
  })
  .refine(
    (value) => {
      const checkIn = parseDateOnly(value.checkIn);
      const checkOut = parseDateOnly(value.checkOut);
      // Bad/missing dates are already reported by DateOnlySchema; never crash here.
      if (!checkIn || !checkOut) return true;
      return nightsCount(checkIn, checkOut) > 0;
    },
    {
      message: "checkOut must be after checkIn",
      path: ["checkOut"],
    },
  )
  .refine(
    (value) => {
      const checkIn = parseDateOnly(value.checkIn);
      const checkOut = parseDateOnly(value.checkOut);
      if (!checkIn || !checkOut) return true;
      return nightsCount(checkIn, checkOut) <= MAX_STAY_NIGHTS;
    },
    {
      message: `stay exceeds the ${MAX_STAY_NIGHTS}-night query guard`,
      path: ["checkOut"],
    },
  );

export type StaySearchInput = z.infer<typeof StaySearchSchema>;
