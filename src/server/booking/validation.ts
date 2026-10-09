import { z } from "zod";
import { BookingStatus, RoomStatus } from "@/generated/prisma/enums";
import { MAX_ROOMS_PER_BOOKING } from "@/config/booking";
import { DateOnlySchema, MAX_STAY_NIGHTS } from "@/server/availability/validation";
import { nightsCount, parseDateOnly } from "@/server/availability/overlap";

/**
 * P5 wire validation — zod at every edge (API bodies, query strings) before the
 * services re-check their own invariants. Empty strings from HTML forms become
 * `undefined`, so "optional" means optional in both JSON and form posts.
 */

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const optionalEmail = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : typeof value === "string"
        ? value.trim()
        : value,
  z.string().trim().toLowerCase().email().max(200).optional(),
);

export const GuestDetailsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: optionalEmail,
  phone: optionalText(40),
  idType: optionalText(40),
  idNumber: optionalText(60),
});

export type GuestDetails = z.infer<typeof GuestDetailsSchema>;

export const roomIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(MAX_ROOMS_PER_BOOKING)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "roomIds must not contain duplicates",
  });

const stayShape = {
  checkIn: DateOnlySchema,
  checkOut: DateOnlySchema,
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20),
};

const stayNightsRefine = (value: { checkIn: string; checkOut: string }) => {
  const checkIn = parseDateOnly(value.checkIn);
  const checkOut = parseDateOnly(value.checkOut);
  if (!checkIn || !checkOut) return true;
  return nightsCount(checkIn, checkOut) > 0;
};

const stayLengthRefine = (value: { checkIn: string; checkOut: string }) => {
  const checkIn = parseDateOnly(value.checkIn);
  const checkOut = parseDateOnly(value.checkOut);
  if (!checkIn || !checkOut) return true;
  return nightsCount(checkIn, checkOut) <= MAX_STAY_NIGHTS;
};

export const MoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "expected a money amount like 450 or 450.00");

/** Public/guest checkout body (email required — the contact point for a booking). */
export const CheckoutSchema = z
  .object({
    ...stayShape,
    roomIds: roomIdsSchema,
    guest: GuestDetailsSchema.extend({ email: z.string().trim().toLowerCase().email().max(200) }),
    promotionCode: optionalText(40),
    notes: optionalText(500),
    /** Total the guest was shown; the server re-prices and refuses any drift. */
    expectedTotal: MoneyStringSchema.optional(),
  })
  .refine(stayNightsRefine, { message: "checkOut must be after checkIn", path: ["checkOut"] })
  .refine(stayLengthRefine, {
    message: `stay exceeds the ${MAX_STAY_NIGHTS}-night query guard`,
    path: ["checkOut"],
  });

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/** Staff walk-in booking: contact email optional, may confirm at the desk. */
export const StaffBookingSchema = z
  .object({
    ...stayShape,
    roomIds: roomIdsSchema,
    guest: GuestDetailsSchema,
    promotionCode: optionalText(40),
    notes: optionalText(500),
    expectedTotal: MoneyStringSchema.optional(),
    /** Create as CONFIRMED instead of PENDING (guest already paying/arriving). */
    confirm: z.boolean().optional().default(false),
  })
  .refine(stayNightsRefine, { message: "checkOut must be after checkIn", path: ["checkOut"] })
  .refine(stayLengthRefine, {
    message: `stay exceeds the ${MAX_STAY_NIGHTS}-night query guard`,
    path: ["checkOut"],
  });

export type StaffBookingInput = z.infer<typeof StaffBookingSchema>;

export const TransitionSchema = z.object({
  to: z.nativeEnum(BookingStatus),
  note: optionalText(500),
});

/** Staff modification: any subset of the stay; omitted fields keep their value. */
export const ModifyBookingSchema = z
  .object({
    checkIn: DateOnlySchema.optional(),
    checkOut: DateOnlySchema.optional(),
    adults: z.coerce.number().int().min(1).max(20).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),
    roomIds: roomIdsSchema.optional(),
    notes: optionalText(500),
    /** undefined = keep the current promotion, null = remove it. */
    promotionCode: z.string().trim().min(1).max(40).nullable().optional(),
    /** Contact fields staff may correct; email stays immutable here. */
    guest: GuestDetailsSchema.partial().optional(),
  })
  .refine(
    (value) =>
      !value.checkIn || !value.checkOut || stayNightsRefine({ checkIn: value.checkIn, checkOut: value.checkOut }),
    {
      message: "checkOut must be after checkIn",
      path: ["checkOut"],
    },
  )
  .refine(
    (value) =>
      !value.checkIn || !value.checkOut || stayLengthRefine({ checkIn: value.checkIn, checkOut: value.checkOut }),
    {
      message: `stay exceeds the ${MAX_STAY_NIGHTS}-night query guard`,
      path: ["checkOut"],
    },
  );

export type ModifyBookingInput = z.infer<typeof ModifyBookingSchema>;

export const RoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus),
  note: optionalText(300),
});

export const BookingNoteSchema = z.object({
  note: z.string().trim().min(1).max(500),
});

export const CancellationRequestSchema = z.object({
  note: optionalText(300),
});

/** `GET /api/public/quote?checkIn=…&checkOut=…&rooms=id1,id2&promotionCode=STAY10` */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const QuoteQuerySchema = z
  .object({
    checkIn: DateOnlySchema,
    checkOut: DateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20).default(1),
    children: z.coerce.number().int().min(0).max(20).default(0),
    rooms: z.string().trim().min(1),
    promotionCode: optionalText(40),
  })
  .refine(stayNightsRefine, { message: "checkOut must be after checkIn", path: ["checkOut"] })
  .refine(stayLengthRefine, {
    message: `stay exceeds the ${MAX_STAY_NIGHTS}-night query guard`,
    path: ["checkOut"],
  })
  .refine(
    (value) =>
      value.rooms
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .every((id) => UUID_REGEX.test(id)),
    { message: "rooms must be a comma-separated list of room ids", path: ["rooms"] },
  )
  .transform((value) => ({
    ...value,
    roomIds: value.rooms
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  }));

// ---------------------------------------------------------------------------
// P6 payments
// ---------------------------------------------------------------------------

export const InitiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
});

export const MockCompleteSchema = z.object({
  bookingId: z.string().uuid(),
  outcome: z.enum(["succeeded", "failed"]),
});

export const RefundSchema = z.object({
  amount: optionalText(12),
});
