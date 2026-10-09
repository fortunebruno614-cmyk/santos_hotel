import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import { bookingStatusLabel } from "@/components/labels";
import { loadHotelContext } from "@/server/pricing/context";

/**
 * Staff reservation list. `?status=CONFIRMED` filters server-side; every row
 * links to the guarded detail view (transitions, modify, notes).
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const hotel = await loadHotelContext();
  const statusFilter =
    sp.status && (Object.values(BookingStatus) as string[]).includes(sp.status)
      ? (sp.status as BookingStatus)
      : null;

  const bookings = await prisma.booking.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    ...(statusFilter ? { where: { bookingStatus: statusFilter } } : {}),
    include: {
      guest: { select: { firstName: true, lastName: true } },
      rooms: { select: { room: { select: { roomNumber: true } } } },
    },
  });

  const statuses = Object.values(BookingStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <Link href="/admin/bookings/new" className="border px-4 py-2 rounded-md text-sm font-medium">
          New booking
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/bookings"
          className={`border px-3 py-1 rounded-md ${!statusFilter ? "font-medium" : ""}`}
        >
          All
        </Link>
        {statuses.map((status) => (
          <Link
            key={status}
            href={`/admin/bookings?status=${status}`}
            className={`border px-3 py-1 rounded-md ${
              statusFilter === status ? "font-medium" : ""
            }`}
          >
            {bookingStatusLabel(status)}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Reference</th>
              <th className="py-2 pr-4">Guest</th>
              <th className="py-2 pr-4">Stay</th>
              <th className="py-2 pr-4">Rooms</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Payment</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-zinc-500">
                  No reservations yet.
                </td>
              </tr>
            )}
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link href={`/admin/bookings/${booking.id}`} className="font-mono underline">
                    {booking.bookingReference}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {booking.guest.firstName} {booking.guest.lastName}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {booking.checkIn.toISOString().slice(0, 10)} →{" "}
                  {booking.checkOut.toISOString().slice(0, 10)}
                </td>
                <td className="py-2 pr-4">
                  {booking.rooms.map((line) => line.room.roomNumber).join(", ")}
                </td>
                <td className="py-2 pr-4">{bookingStatusLabel(booking.bookingStatus)}</td>
                <td className="py-2 pr-4">{booking.paymentStatus}</td>
                <td className="py-2">{booking.total.toString()} {hotel.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
