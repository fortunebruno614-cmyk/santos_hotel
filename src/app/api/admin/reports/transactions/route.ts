import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { parseAnalyticsRange } from "@/server/console/analytics";
import { BookingStatus } from "@/generated/prisma/enums";

const REVENUE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
  BookingStatus.CHECKED_OUT,
  BookingStatus.NO_SHOW,
];

/** Tenant-scoped booking/transaction report (CSV) for the dashboard action. */
export async function GET(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/reports/transactions",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.VIEW_REPORTS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.VIEW_REPORTS);
  if (tenant instanceof NextResponse) return tenant;

  const range = parseAnalyticsRange(
    new URL(request.url).searchParams.get("range") ?? undefined,
  );
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId: tenant.hotelId,
      bookingStatus: { in: REVENUE_STATUSES },
      checkIn: { gte: from, lte: now },
    },
    orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }],
    select: {
      bookingReference: true,
      checkIn: true,
      checkOut: true,
      total: true,
      currency: true,
      bookingStatus: true,
      paymentStatus: true,
      guest: { select: { firstName: true, lastName: true, email: true } },
      rooms: {
        select: { room: { select: { roomNumber: true, roomType: { select: { name: true } } } } },
      },
    },
  });

  const header = [
    "Reference",
    "Customer",
    "Email",
    "Check-in",
    "Check-out",
    "Rooms",
    "Room types",
    "Booking status",
    "Payment status",
    "Amount",
    "Currency",
  ];
  const lines = bookings.map((booking) =>
    [
      booking.bookingReference,
      `${booking.guest.firstName} ${booking.guest.lastName}`,
      booking.guest.email ?? "",
      booking.checkIn.toISOString().slice(0, 10),
      booking.checkOut.toISOString().slice(0, 10),
      booking.rooms.map((line) => line.room.roomNumber).join(" "),
      booking.rooms.map((line) => line.room.roomType.name).join(" "),
      booking.bookingStatus,
      booking.paymentStatus,
      booking.total.toString(),
      booking.currency ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );

  const csv = [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings-${range}.csv"`,
    },
  });
}
