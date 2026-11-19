import { prisma } from "@/lib/prisma";
import { listPendingKycSubmissions } from "@/server/onboarding/kyc";

/**
 * Real, tenant-agnostic marketplace data for the platform console. Every
 * number here comes from the database; the UI never fabricates metrics.
 */

export const PLATFORM_RANGES = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "365d", label: "12 months", days: 365 },
] as const;

export type PlatformRange = (typeof PLATFORM_RANGES)[number]["value"];

export function parsePlatformRange(value: string | undefined): PlatformRange {
  return PLATFORM_RANGES.some((range) => range.value === value)
    ? (value as PlatformRange)
    : "30d";
}

const DAY = 24 * 60 * 60 * 1000;

type Bucket = { start: Date; end: Date; label: string };

function buildBuckets(range: PlatformRange, now: Date): Bucket[] {
  if (range === "365d") {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      return {
        start,
        end,
        label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(start),
      };
    });
  }

  if (range === "90d") {
    return Array.from({ length: 13 }, (_, index) => {
      const end = new Date(now.getTime() - (12 - index) * 7 * DAY);
      const start = new Date(end.getTime() - 7 * DAY);
      return {
        start,
        end,
        label: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        }).format(start),
      };
    });
  }

  const days = range === "7d" ? 7 : 30;
  return Array.from({ length: days }, (_, index) => {
    const start = new Date(now.getTime() - (days - 1 - index) * DAY);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + DAY);
    return {
      start,
      end,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(start),
    };
  });
}

function bucketIndex(buckets: Bucket[], date: Date) {
  for (let index = 0; index < buckets.length; index += 1) {
    if (date >= buckets[index].start && date < buckets[index].end) return index;
  }
  return -1;
}

function percentage(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function money(value: { amount: unknown; refundedAmount: unknown }) {
  return Number(value.amount) - Number(value.refundedAmount);
}

export async function getPlatformDashboard(range: PlatformRange) {
  const now = new Date();
  const buckets = buildBuckets(range, now);
  const from = buckets[0].start;
  const rangeDays = PLATFORM_RANGES.find((entry) => entry.value === range)?.days ?? 30;
  const previousFrom = new Date(from.getTime() - rangeDays * DAY);
  const rangeLabel = PLATFORM_RANGES.find((entry) => entry.value === range)?.label ?? "30 days";

  const [
    organizationTotal,
    organizationStatusGroups,
    propertyTotal,
    publicationGroups,
    pendingVerification,
    approvedVerification,
    pendingReviews,
    operatorTotal,
    memberTotal,
    organizationRows,
    previousOrganizationCount,
    propertyRows,
    previousPropertyCount,
    bookingRows,
    previousBookingCount,
    paymentRows,
    previousPayments,
    recentOrganizations,
    pendingKyc,
    reviewHotels,
    activity,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.hotel.count(),
    prisma.hotel.groupBy({ by: ["publicationStatus"], _count: { _all: true } }),
    prisma.organizationKyc.count({ where: { status: "PENDING" } }),
    prisma.organizationKyc.count({ where: { status: "APPROVED" } }),
    prisma.hotel.count({
      where: { publicationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.user.count({ where: { platformRole: { not: null }, isActive: true } }),
    prisma.organizationMember.count({ where: { status: "ACTIVE" } }),
    prisma.organization.findMany({
      where: { createdAt: { gte: from, lt: now } },
      select: { createdAt: true },
    }),
    prisma.organization.count({ where: { createdAt: { gte: previousFrom, lt: from } } }),
    prisma.hotel.findMany({
      where: { createdAt: { gte: from, lt: now } },
      select: { createdAt: true },
    }),
    prisma.hotel.count({ where: { createdAt: { gte: previousFrom, lt: from } } }),
    prisma.booking.findMany({
      where: { createdAt: { gte: from, lt: now } },
      select: { createdAt: true },
    }),
    prisma.booking.count({ where: { createdAt: { gte: previousFrom, lt: from } } }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: from, lt: now },
        status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      },
      select: { amount: true, refundedAmount: true, paidAt: true, currency: true },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: previousFrom, lt: from },
        status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      },
      select: { amount: true, refundedAmount: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        _count: { select: { hotels: true, members: true } },
        kyc: { select: { status: true } },
        hotels: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            publicationStatus: true,
            city: true,
            country: true,
            currency: true,
          },
        },
      },
    }),
    listPendingKycSubmissions(6),
    prisma.hotel.findMany({
      where: { publicationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        publicationStatus: true,
        updatedAt: true,
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { startsWith: "organization." } },
          { action: { startsWith: "listing." } },
          { action: { startsWith: "membership." } },
          { action: { startsWith: "user." } },
          { action: "auth.signup" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { id: true, name: true } },
        hotel: { select: { id: true, name: true } },
      },
    }),
  ]);

  const publication = Object.fromEntries(
    publicationGroups.map((group) => [group.publicationStatus as string, group._count._all]),
  ) as Record<string, number>;
  const organizationStatus = Object.fromEntries(
    organizationStatusGroups.map((group) => [group.status as string, group._count._all]),
  ) as Record<string, number>;

  const series = {
    labels: buckets.map((bucket) => bucket.label),
    organizations: buckets.map(() => 0),
    properties: buckets.map(() => 0),
    bookings: buckets.map(() => 0),
    revenue: buckets.map(() => 0),
  };

  for (const row of organizationRows) {
    const index = bucketIndex(buckets, row.createdAt);
    if (index >= 0) series.organizations[index] += 1;
  }
  for (const row of propertyRows) {
    const index = bucketIndex(buckets, row.createdAt);
    if (index >= 0) series.properties[index] += 1;
  }
  for (const row of bookingRows) {
    const index = bucketIndex(buckets, row.createdAt);
    if (index >= 0) series.bookings[index] += 1;
  }
  for (const row of paymentRows) {
    if (!row.paidAt) continue;
    const index = bucketIndex(buckets, row.paidAt);
    if (index >= 0) series.revenue[index] += money(row);
  }

  const revenue = paymentRows.reduce((sum, row) => sum + money(row), 0);
  const previousRevenue = previousPayments.reduce((sum, row) => sum + money(row), 0);
  const bookings = bookingRows.length;
  const publishedProperties = publication.PUBLISHED ?? 0;
  const revenueCurrency = paymentRows[0]?.currency ?? "NGN";

  return {
    range,
    rangeLabel,
    generatedAt: now.toISOString(),
    from: from.toISOString(),
    to: now.toISOString(),
    totals: {
      organizations: organizationTotal,
      activeOrganizations: organizationStatus.ACTIVE ?? 0,
      properties: propertyTotal,
      publishedProperties,
      pendingVerification,
      approvedVerification,
      pendingReviews,
      operators: operatorTotal,
      members: memberTotal,
      bookings,
      revenue,
      revenueCurrency,
    },
    deltas: {
      organizations: percentage(organizationRows.length, previousOrganizationCount),
      properties: percentage(propertyRows.length, previousPropertyCount),
      bookings: percentage(bookings, previousBookingCount),
      revenue: percentage(revenue, previousRevenue),
    },
    newInRange: {
      organizations: organizationRows.length,
      properties: propertyRows.length,
    },
    series,
    publication,
    organizationStatus,
    recentOrganizations: recentOrganizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      email: org.email,
      createdAt: org.createdAt.toISOString(),
      hotelCount: org._count.hotels,
      memberCount: org._count.members,
      kycStatus: org.kyc?.status ?? null,
      firstHotel: org.hotels[0]
        ? {
            id: org.hotels[0].id,
            name: org.hotels[0].name,
            publicationStatus: org.hotels[0].publicationStatus,
            city: org.hotels[0].city,
            country: org.hotels[0].country,
            currency: org.hotels[0].currency,
          }
        : null,
    })),
    pendingKyc,
    reviewHotels: reviewHotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      publicationStatus: hotel.publicationStatus,
      updatedAt: hotel.updatedAt.toISOString(),
      organizationId: hotel.organization.id,
      organizationName: hotel.organization.name,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.user?.name ?? entry.actorType ?? "system",
      actorEmail: entry.user?.email ?? null,
      organizationId: entry.organization?.id ?? null,
      organizationName: entry.organization?.name ?? null,
      hotelId: entry.hotel?.id ?? null,
      hotelName: entry.hotel?.name ?? null,
    })),
  };
}

export type PlatformDashboard = Awaited<ReturnType<typeof getPlatformDashboard>>;
