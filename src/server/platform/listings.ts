import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { ConsoleError } from "@/server/console/errors";
import type { PropertyPublicationStatus } from "@/generated/prisma/client";

/**
 * Property publication lifecycle (REQ-014/REQ-015/M5). Every transition that
 * changes public visibility writes a ListingReview row (actor + reason +
 * timestamp) and an audit row.
 */

const TRANSITIONS: Record<PropertyPublicationStatus, PropertyPublicationStatus[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["UNDER_REVIEW", "DRAFT", "ARCHIVED"],
  UNDER_REVIEW: ["PUBLISHED", "DRAFT", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "SUSPENDED", "ARCHIVED"],
  PAUSED: ["PUBLISHED", "ARCHIVED"],
  SUSPENDED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

export function allowedPublicationTransitions(from: PropertyPublicationStatus) {
  return TRANSITIONS[from] ?? [];
}

async function assertPublishable(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      name: true,
      email: true,
      phone: true,
      addressLine1: true,
      city: true,
      country: true,
    },
  });
  if (!hotel) throw new ConsoleError("not_found", "hotel not found");
  const missing: string[] = [];
  if (!hotel.name?.trim()) missing.push("name");
  if (!hotel.phone?.trim() && !hotel.email?.trim()) missing.push("contact");
  if (!hotel.addressLine1?.trim()) missing.push("address");
  if (!hotel.city?.trim()) missing.push("city");
  if (!hotel.country?.trim()) missing.push("country");

  const sellable = await prisma.roomType.count({
    where: { hotelId, status: "ACTIVE", rooms: { some: {} } },
  });
  if (sellable === 0) missing.push("an active room type with at least one room");

  if (missing.length > 0) {
    throw new ConsoleError(
      "incomplete_listing",
      `listing cannot be published yet: ${missing.join(", ")}`,
    );
  }
}

export async function transitionHotelPublication(
  hotelId: string,
  to: PropertyPublicationStatus,
  actor: { userId: string },
  reason?: string | null,
) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, organizationId: true, publicationStatus: true },
  });
  if (!hotel) throw new ConsoleError("not_found", "hotel not found");
  const from = hotel.publicationStatus;
  if (from === to) return hotel;
  if (!allowedPublicationTransitions(from).includes(to)) {
    throw new ConsoleError("invalid_transition", `cannot move a ${from} listing to ${to}`);
  }
  if (to === "PUBLISHED") await assertPublishable(hotelId);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hotel.update({
      where: { id: hotelId },
      data: { publicationStatus: to },
    });
    await tx.listingReview.create({
      data: {
        hotelId,
        fromStatus: from,
        toStatus: to,
        decisionReason: reason?.trim() || null,
        reviewerUserId: actor.userId,
      },
    });
    return row;
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId: hotel.organizationId,
    hotelId,
    action:
      to === "PUBLISHED"
        ? "listing.publish"
        : to === "PAUSED"
          ? "listing.pause"
          : to === "SUSPENDED"
            ? "listing.suspend"
            : to === "ARCHIVED"
              ? "listing.archive"
              : "listing.review",
    entityType: "hotel",
    entityId: hotelId,
    oldValues: { publicationStatus: from },
    newValues: { publicationStatus: to, reason: reason ?? null },
  });
  return updated;
}

export async function verifyHotelLocation(
  hotelId: string,
  input: {
    latitude: number;
    longitude: number;
    precision: "APPROXIMATE" | "NEIGHBORHOOD" | "EXACT";
  },
  actor: { userId: string },
) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, organizationId: true, latitude: true, longitude: true },
  });
  if (!hotel) throw new ConsoleError("not_found", "hotel not found");

  const updated = await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      latitude: input.latitude,
      longitude: input.longitude,
      locationVerification: "PLATFORM_VERIFIED",
      locationPrecision: input.precision,
      verifiedAt: new Date(),
      verifiedById: actor.userId,
    },
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId: hotel.organizationId,
    hotelId,
    action: "listing.verify_location",
    entityType: "hotel",
    entityId: hotelId,
    oldValues: { latitude: hotel.latitude?.toString() ?? null, longitude: hotel.longitude?.toString() ?? null },
    newValues: { ...input },
  });
  return updated;
}
