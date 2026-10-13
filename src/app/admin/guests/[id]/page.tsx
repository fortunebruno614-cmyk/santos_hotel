import Link from "next/link";
import { notFound } from "next/navigation";
import { bookingStatusLabel } from "@/components/labels";
import { getGuestDetail } from "@/server/console/guests";
import { ConsoleError } from "@/server/console/errors";
import { GuestEditForm } from "./guest-edit-form";

/** Guest record (P7): full stay + money history plus contact corrections. */
export default async function AdminGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let guest;
  try {
    guest = await getGuestDetail(id);
  } catch (error) {
    if (error instanceof ConsoleError) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {guest.firstName} {guest.lastName}
          </h1>
          <p className="text-sm text-zinc-500">
            {guest.email ?? "no e-mail"} · {guest.phone ?? "no phone"} ·{" "}
            {guest.isActive ? "Active" : "Inactive"} · since{" "}
            {guest.createdAt.slice(0, 10)}
          </p>
        </div>
        <Link href="/admin/guests" className="text-sm underline">
          ← All guests
        </Link>
      </div>

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

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Reservations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Stay</th>
                <th className="py-2 pr-4">Rooms</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {guest.bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-zinc-500">
                    No reservations yet.
                  </td>
                </tr>
              )}
              {guest.bookings.map((booking) => (
                <tr key={booking.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/bookings/${booking.id}`} className="font-mono underline">
                      {booking.bookingReference}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {booking.checkIn} → {booking.checkOut}
                  </td>
                  <td className="py-2 pr-4">{booking.roomNumbers.join(", ")}</td>
                  <td className="py-2 pr-4">{bookingStatusLabel(booking.bookingStatus)}</td>
                  <td className="py-2 pr-4">{booking.paymentStatus}</td>
                  <td className="py-2">
                    {booking.total} {booking.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Payments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Booking</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Refunded</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Paid at</th>
              </tr>
            </thead>
            <tbody>
              {guest.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-zinc-500">
                    No payments recorded.
                  </td>
                </tr>
              )}
              {guest.payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{payment.bookingReference}</td>
                  <td className="py-2 pr-4">{payment.provider}</td>
                  <td className="py-2 pr-4">{payment.amount}</td>
                  <td className="py-2 pr-4">{payment.refundedAmount}</td>
                  <td className="py-2 pr-4">{payment.status}</td>
                  <td className="py-2">{payment.paidAt?.slice(0, 10) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
