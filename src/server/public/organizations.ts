import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus, PropertyPublicationStatus } from "@/generated/prisma/enums";

/**
 * Public tenant entry channel (M6).
 *
 * An organization slug is the public entry point for a hotel group. The tenant
 * is resolved from the database and must be ACTIVE; a suspended, closed or
 * unknown organization is simply not found. Properties are still filtered to
 * PUBLISHED so an entry channel can never expose a draft listing.
 */
export const getPublicOrganizationBySlug = cache(async (slug: string) => {
  return prisma.organization.findFirst({
    where: { slug, status: OrganizationStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      country: true,
    },
  });
});

/** Published properties inside one organization's entry channel. */
export async function listOrganizationPublishedHotels(organizationId: string) {
  return prisma.hotel.findMany({
    where: {
      organizationId,
      publicationStatus: PropertyPublicationStatus.PUBLISHED,
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
    },
  });
}
