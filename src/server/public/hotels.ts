import { prisma } from "@/lib/prisma";
import { PropertyPublicationStatus } from "@/generated/prisma/enums";

/**
 * Public hotel discovery (M6).
 *
 * Public pages never invent ownership context: a property is resolved by its
 * published slug, or — for the single-property marketing site — by the
 * explicitly configured `DEFAULT_HOTEL_SLUG`. Falling back to the oldest
 * published row exists only so a fresh seed renders before the env var is set;
 * it is a *public marketing default*, never an authorization decision.
 */
export const DEFAULT_HOTEL_SLUG = process.env.DEFAULT_HOTEL_SLUG?.trim() || null;

export async function getDefaultHotel() {
  if (DEFAULT_HOTEL_SLUG) {
    const configured = await prisma.hotel.findUnique({
      where: { slug: DEFAULT_HOTEL_SLUG },
    });
    if (configured) return configured;
  }
  return prisma.hotel.findFirst({
    where: { publicationStatus: PropertyPublicationStatus.PUBLISHED },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPublishedHotelBySlug(slug: string) {
  return prisma.hotel.findFirst({
    where: {
      slug,
      publicationStatus: PropertyPublicationStatus.PUBLISHED,
      organization: { status: "ACTIVE" },
    },
  });
}

export async function listPublishedHotels() {
  return prisma.hotel.findMany({
    where: {
      publicationStatus: PropertyPublicationStatus.PUBLISHED,
      organization: { status: "ACTIVE" },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      country: true,
      currency: true,
      latitude: true,
      longitude: true,
    },
  });
}
