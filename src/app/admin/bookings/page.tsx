import Link from "next/link";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import { bookingStatusLabel } from "@/components/labels";
import { searchBookings } from "@/server/console/bookings";
import { BookingSearchSchema } from "@/server/console/validation";
import { loadHotelContext } from "@/server/pricing/context";

/**
 * Staff reservation list (P7): search by reference / guest / room number and
 * filter by status, payment status and date range (overlap semantics). Every
 * row links to the guarded detail view (transitions, modify, notes, payments).
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const hotel = await loadHotelContext();

  const parsed = BookingSearchSchema.safeParse({
    q: sp.q ?? undefined,
    status: sp.status ?? undefined,
    paymentStatus: sp.paymentStatus ?? undefined,
    from: sp.from ?? undefined,
    to: sp.to ?? undefined,
    page: sp.page ?? undefined,
    pageSize: sp.pageSize ?? undefined,
  });
  const query = parsed.success
    ? parsed.data
    : BookingSearchSchema.parse({});

  const result = await searchBookings(query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));

  const statuses = Object.values(BookingStatus);
  const paymentStatuses = Object.values(PaymentStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <Link href="/admin/bookings/new" className="border px-4 py-2 rounded-md text-sm font-medium">
          New booking
        </Link>
      </div>

      <form method="get" action="/admin/bookings" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Search</span>
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Reference, guest, room…"
            className="border px-2 py-1 rounded-md w-56"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select name="status" defaultValue={query.status ?? ""} className="border px-2 py-1 rounded-md">
            <option value="">Any</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {bookingStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Payment</span>
          <select
            name="paymentStatus"
            defaultValue={query.paymentStatus ?? ""}
            className="border px-2 py-1 rounded-md"
          >
            <option value="">Any</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">From (overlap)</span>
          <input type="date" name="from" defaultValue={query.from ?? ""} className="border px-2 py-1 rounded-md" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">To (overlap)</span>
          <input type="date" name="to" defaultValue={query.to ?? ""} className="border px-2 py-1 rounded-md" />
        </label>
        <button className="border px-3 py-1 rounded-md">Filter</button>
        <Link href="/admin/bookings" className="text-zinc-500 underline">
          Reset
        </Link>
      </form>

      <p className="text-sm text-zinc-500">
        {result.total} reservation{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </p>

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
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-zinc-500">
                  No reservations match this filter.
                </td>
              </tr>
            )}
            {result.rows.map((booking) => (
              <tr key={booking.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link href={`/admin/bookings/${booking.id}`} className="font-mono underline">
                    {booking.bookingReference}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/guests/${booking.guestId}`} className="underline">
                    {booking.guestName}
                  </Link>
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {booking.checkIn} → {booking.checkOut}
                </td>
                <td className="py-2 pr-4">{booking.roomNumbers.join(", ")}</td>
                <td className="py-2 pr-4">{bookingStatusLabel(booking.bookingStatus)}</td>
                <td className="py-2 pr-4">{booking.paymentStatus}</td>
                <td className="py-2">
                  {booking.total} {hotel.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2 text-sm">
          {Array.from({ length: pages }, (_, index) => index + 1).map((page) => {
            const params = new URLSearchParams();
            if (query.q) params.set("q", query.q);
            if (query.status) params.set("status", query.status);
            if (query.paymentStatus) params.set("paymentStatus", query.paymentStatus);
            if (query.from) params.set("from", query.from);
            if (query.to) params.set("to", query.to);
            params.set("page", String(page));
            return (
              <Link
                key={page}
                href={`/admin/bookings?${params.toString()}`}
                className={`border px-2 py-1 rounded-md ${page === result.page ? "font-medium" : ""}`}
              >
                {page}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
