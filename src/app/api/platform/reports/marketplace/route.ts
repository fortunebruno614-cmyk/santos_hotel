import { NextResponse } from "next/server";
import { guardPlatformApi } from "@/server/auth/api";
import { prisma } from "@/lib/prisma";

function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Platform marketplace export. Real rows only; guarded by the platform axis so
 * tenant staff can never download another organization's book of business.
 */
export async function GET() {
  const auth = await guardPlatformApi("/api/platform/reports/marketplace");
  if (auth instanceof NextResponse) return auth;

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      kyc: { select: { status: true } },
      _count: { select: { members: true } },
      hotels: {
        orderBy: { name: "asc" },
        include: { _count: { select: { rooms: true, roomTypes: true, bookings: true } } },
      },
    },
  });

  const header = [
    "organization",
    "organization_slug",
    "organization_status",
    "kyc_status",
    "members",
    "property",
    "property_slug",
    "publication_status",
    "city",
    "country",
    "currency",
    "rooms",
    "room_types",
    "bookings",
  ];

  const rows: string[] = [header.join(",")];
  for (const organization of organizations) {
    if (organization.hotels.length === 0) {
      rows.push(
        [
          organization.name,
          organization.slug,
          organization.status,
          organization.kyc?.status ?? "",
          organization._count.members,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(cell)
          .join(","),
      );
      continue;
    }
    for (const hotel of organization.hotels) {
      rows.push(
        [
          organization.name,
          organization.slug,
          organization.status,
          organization.kyc?.status ?? "",
          organization._count.members,
          hotel.name,
          hotel.slug,
          hotel.publicationStatus,
          hotel.city ?? "",
          hotel.country ?? "",
          hotel.currency,
          hotel._count.rooms,
          hotel._count.roomTypes,
          hotel._count.bookings,
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(rows.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="santo-marketplace-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
