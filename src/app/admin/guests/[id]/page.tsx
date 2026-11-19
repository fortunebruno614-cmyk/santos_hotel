import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardHeader,
  EmptyRow,
  PageHeader,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { bookingStatusLabel } from "@/components/labels";
import { getGuestDetail } from "@/server/console/guests";
import { getConsoleContext } from "@/server/console/context";
import { ConsoleError } from "@/server/console/errors";
import { GuestEditForm } from "./guest-edit-form";

/** Guest record (P7): full stay + money history plus contact corrections. */
export default async function AdminGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { hotel } = await getConsoleContext();
  let guest;
  try {
    guest = await getGuestDetail(hotel.id, id);
  } catch (error) {
    if (error instanceof ConsoleError) notFound();
    throw error;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/admin/guests"
        backLabel="All guests"
        title={`${guest.firstName} ${guest.lastName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={guest.isActive ? "ACTIVE" : "INACTIVE"}
              label={guest.isActive ? "Active" : "Inactive"}
            />
            <span>
              {guest.email ?? "no e-mail"} · {guest.phone ?? "no phone"} · since{" "}
              {guest.createdAt.slice(0, 10)}
            </span>
          </span>
        }
      />

      <GuestEditForm
        guest={{
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
          idType: guest.idType,
          idNumber: guest.idNumber,
          isActive: guest.isActive,
        }}
      />

      <Card>
        <CardHeader title="Reservations" description="Every stay this guest has booked." />
        <TableShell className="rounded-t-none border-0 shadow-none">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Stay</th>
              <th>Rooms</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {guest.bookings.length === 0 && <EmptyRow colSpan={6}>No reservations yet.</EmptyRow>}
            {guest.bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="admin-mono font-medium text-primary hover:underline"
                  >
                    {booking.bookingReference}
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
                  {booking.total} {booking.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>

      <Card>
        <CardHeader title="Payments" description="Money captured for this guest's stays." />
        <TableShell className="rounded-t-none border-0 shadow-none">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Provider</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Refunded</th>
              <th>Status</th>
              <th>Paid at</th>
            </tr>
          </thead>
          <tbody>
            {guest.payments.length === 0 && <EmptyRow colSpan={6}>No payments recorded.</EmptyRow>}
            {guest.payments.map((payment) => (
              <tr key={payment.id}>
                <td className="admin-mono">{payment.bookingReference}</td>
                <td>{payment.provider}</td>
                <td className="text-right tabular-nums">{payment.amount}</td>
                <td className="text-right tabular-nums">{payment.refundedAmount}</td>
                <td>
                  <StatusBadge status={payment.status} />
                </td>
                <td className="whitespace-nowrap">{payment.paidAt?.slice(0, 10) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}
