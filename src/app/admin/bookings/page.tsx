import Link from "next/link";
import { Plus } from "lucide-react";
import {
  EmptyRow,
  Field,
  PageHeader,
  Pagination,
  ResultCount,
  StatusBadge,
  TableShell,
  Toolbar,
} from "@/components/admin/ui";
import { bookingStatusLabel } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import { searchBookings } from "@/server/console/bookings";
import { BookingSearchSchema } from "@/server/console/validation";
import { getConsoleContext } from "@/server/console/context";

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
  const { hotel } = await getConsoleContext();

  const parsed = BookingSearchSchema.safeParse({
    q: sp.q ?? undefined,
    status: sp.status ?? undefined,
    paymentStatus: sp.paymentStatus ?? undefined,
    from: sp.from ?? undefined,
    to: sp.to ?? undefined,
    page: sp.page ?? undefined,
    pageSize: sp.pageSize ?? undefined,
  });
  const query = parsed.success ? parsed.data : BookingSearchSchema.parse({});

  const result = await searchBookings(hotel.id, query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));

  const statuses = Object.values(BookingStatus);
  const paymentStatuses = Object.values(PaymentStatus);

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.paymentStatus) params.set("paymentStatus", query.paymentStatus);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/admin/bookings?${search}` : "/admin/bookings";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservations"
        description="Every stay booked online, at the desk or over the phone. Open a row to change its status, rooms or payment."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/bookings/new">
              <Plus /> New booking
            </Link>
          </Button>
        }
      />

      <Toolbar>
        <form method="get" action="/admin/bookings" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="w-56">
            <input name="q" defaultValue={query.q ?? ""} placeholder="Reference, guest, room…" />
          </Field>
          <Field label="Status" className="w-40">
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">Any</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {bookingStatusLabel(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment" className="w-40">
            <select name="paymentStatus" defaultValue={query.paymentStatus ?? ""}>
              <option value="">Any</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From (overlap)" className="w-40">
            <input type="date" name="from" defaultValue={query.from ?? ""} />
          </Field>
          <Field label="To (overlap)" className="w-40">
            <input type="date" name="to" defaultValue={query.to ?? ""} />
          </Field>
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/bookings">Reset</Link>
          </Button>
        </form>
      </Toolbar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount>
          {result.total} reservation{result.total === 1 ? "" : "s"} · page {result.page} of{" "}
          {pages}
        </ResultCount>
      </div>

      <TableShell>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Guest</th>
            <th>Stay</th>
            <th>Rooms</th>
            <th>Status</th>
            <th>Payment</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && (
            <EmptyRow colSpan={7}>No reservations match this filter.</EmptyRow>
          )}
          {result.rows.map((booking) => (
            <tr key={booking.id}>
              <td>
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="admin-mono font-medium text-primary hover:underline"
                >
                  {booking.bookingReference}
                </Link>
              </td>
              <td>
                <Link href={`/admin/guests/${booking.guestId}`} className="hover:underline">
                  {booking.guestName}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                {booking.checkIn} → {booking.checkOut}
              </td>
              <td>{booking.roomNumbers.join(", ")}</td>
              <td>
                <StatusBadge
                  status={booking.bookingStatus}
                  label={bookingStatusLabel(booking.bookingStatus)}
                />
              </td>
              <td>
                <StatusBadge status={booking.paymentStatus} />
              </td>
              <td className="text-right tabular-nums whitespace-nowrap">
                {booking.total} {hotel.currency}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination page={result.page} pages={pages} hrefFor={hrefFor} />
    </div>
  );
}
