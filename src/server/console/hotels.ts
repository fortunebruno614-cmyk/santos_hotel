import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { ConsoleError } from "@/server/console/errors";
import { z as zod } from "zod";

/**
 * Hotel (property) onboarding. A hotel always belongs to exactly one
 * organization; its business address and verified map position are part of
 * the creation record, not an afterthought.
 */

export const HotelCreateSchema = zod
  .object({
    name: zod.string().trim().min(2).max(120),
    slug: zod
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase slug like santo-hotel"),
    description: zod.string().trim().max(2000).optional().nullable(),
    phone: zod.string().trim().max(40).optional().nullable(),
    email: zod.string().trim().toLowerCase().email().max(200).optional().nullable(),
    addressLine1: zod.string().trim().max(200).optional().nullable(),
    addressLine2: zod.string().trim().max(200).optional().nullable(),
    city: zod.string().trim().max(100).optional().nullable(),
    postcode: zod.string().trim().max(20).optional().nullable(),
    country: zod.string().trim().max(100).optional().nullable(),
    timezone: zod.string().trim().min(1).max(80).default("Africa/Lagos"),
    currency: zod
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "expected a 3-letter ISO currency")
      .default("NGN"),
    latitude: zod.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: zod.coerce.number().min(-180).max(180).nullable().optional(),
    publicationStatus: zod
      .enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PUBLISHED", "PAUSED", "SUSPENDED", "ARCHIVED"])
      .default("DRAFT"),
  })
  .refine(
    (value) =>
      (value.latitude === undefined || value.latitude === null) ===
      (value.longitude === undefined || value.longitude === null),
    { message: "latitude and longitude must be set together", path: ["latitude"] },
  );

export type HotelCreateInput = zod.infer<typeof HotelCreateSchema>;

export async function createHotel(
  organizationId: string,
  input: HotelCreateInput,
  actor: { userId: string; platform?: boolean },
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true },
  });
  if (!organization) throw new ConsoleError("not_found", "organization not found");

  const clash = await prisma.hotel.findUnique({ where: { slug: input.slug } });
  if (clash) throw new ConsoleError("conflict", `the slug ${input.slug} is already in use`);

  const hotel = await prisma.hotel.create({
    data: {
      organizationId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      postcode: input.postcode ?? null,
      country: input.country ?? null,
      timezone: input.timezone,
      currency: input.currency,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      publicationStatus: actor.platform ? input.publicationStatus : "DRAFT",
      // A tenant-entered pin is stored but not "verified"; only a platform
      // operator can mark coordinates PLATFORM_VERIFIED (MR-07/REQ-018).
      ...(actor.platform && input.latitude != null && input.longitude != null
        ? {
            locationVerification: "PLATFORM_VERIFIED",
            locationPrecision: "EXACT",
            verifiedAt: new Date(),
            verifiedById: actor.userId,
          }
        : {}),
    },
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId,
    hotelId: hotel.id,
    action: "hotel.create",
    entityType: "hotel",
    entityId: hotel.id,
    newValues: {
      name: hotel.name,
      slug: hotel.slug,
      city: hotel.city,
      country: hotel.country,
      currency: hotel.currency,
      publicationStatus: hotel.publicationStatus,
    },
  });

  return hotel;
}
