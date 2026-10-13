import { z } from "zod";
import {
  BookingStatus,
  PaymentStatus,
  PromotionType,
  RecordStatus,
  RoomStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { DateOnlySchema } from "@/server/availability/validation";
import { MoneyStringSchema, optionalText } from "@/server/booking/validation";

/**
 * P7 console wire validation — zod at every admin/staff mutation edge, before
 * the services re-check their invariants (duplicates, referential use).
 */

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase slug like deluxe-king");

const uuid = z.string().uuid();
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

export const RoomTypeUpsertSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: optionalText(1000),
  maxAdults: z.coerce.number().int().min(1).max(20),
  maxChildren: z.coerce.number().int().min(0).max(20).default(0),
  basePrice: MoneyStringSchema,
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
  amenityIds: z.array(uuid).max(50).optional(),
});

export type RoomTypeUpsertInput = z.infer<typeof RoomTypeUpsertSchema>;

export const RoomUpsertSchema = z.object({
  roomNumber: z.string().trim().min(1).max(12),
  floor: z.coerce.number().int().min(-5).max(200).nullable().optional(),
  roomTypeId: uuid,
  status: z.nativeEnum(RoomStatus).default(RoomStatus.AVAILABLE),
  notes: optionalText(500),
});

export type RoomUpsertInput = z.infer<typeof RoomUpsertSchema>;

export const AmenityUpsertSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(300),
});

export const RateUpsertSchema = z.object({
  roomTypeId: uuid,
  name: z.string().trim().min(2).max(80),
  amount: MoneyStringSchema,
  startDate: DateOnlySchema,
  endDate: DateOnlySchema,
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

export const PromotionUpsertSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/, "expected a code like STAY10"),
    type: z.nativeEnum(PromotionType),
    value: MoneyStringSchema,
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    maxUses: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
    status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
  })
  .refine((value) => value.endAt > value.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

// ---------------------------------------------------------------------------
// P7 system settings + website content
// ---------------------------------------------------------------------------

export const SettingsPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: optionalText(2000),
    phone: optionalText(40),
    email: optionalText(200),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    postcode: optionalText(20),
    country: optionalText(100),
    timezone: z.string().trim().min(1).max(60).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "expected a 3-letter currency code")
      .transform((value) => value.toUpperCase())
      .optional(),
    checkInTime: clockSchema.optional(),
    checkOutTime: clockSchema.optional(),
    taxRatePercent: z.coerce.number().min(0).max(100).optional(),
    serviceFee: MoneyStringSchema.optional(),
    cancellationWindowHours: z.coerce.number().int().min(0).max(8760).optional(),
    guestCancellationEnabled: z.boolean().optional(),
    maxRoomsPerBooking: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no settings supplied" });

export type SettingsPatchInput = z.infer<typeof SettingsPatchSchema>;

export const ContentUpsertSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:\.[a-z0-9]+)*$/, "expected a slot key like home.hero"),
  title: optionalText(200),
  body: z.string().max(5000).default(""),
});

// ---------------------------------------------------------------------------
// P7 user & guest administration
// ---------------------------------------------------------------------------

export const UserCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum([UserRole.ADMIN, UserRole.STAFF]),
});

export const UserUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    role: z.enum([UserRole.ADMIN, UserRole.STAFF]).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no changes supplied" });

export const GuestUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().toLowerCase().email().max(200).nullable().optional(),
    ),
    phone: optionalText(40),
    idType: optionalText(40),
    idNumber: optionalText(60),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no changes supplied" });

// ---------------------------------------------------------------------------
// P7 reservation search & payment filters (query strings)
// ---------------------------------------------------------------------------

export const BookingSearchSchema = z.object({
  q: optionalText(120),
  status: z.nativeEnum(BookingStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type BookingSearchInput = z.infer<typeof BookingSearchSchema>;

export const PaymentSearchSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: optionalText(40),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaymentSearchInput = z.infer<typeof PaymentSearchSchema>;

export const GuestSearchSchema = z.object({
  q: optionalText(120),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AuditSearchSchema = z.object({
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(64).optional(),
  userId: z.string().uuid().optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditSearchInput = z.infer<typeof AuditSearchSchema>;
