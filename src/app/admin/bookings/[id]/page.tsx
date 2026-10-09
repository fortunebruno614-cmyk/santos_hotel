import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingActions } from "./booking-actions";
import { BookingError, getBookingDetail } from "@/server/booking/service";
import { bookingStatusLabel } from "@/components/labels";
import { formatMoney } from "@/server/pricing/context";

/** Staff reservation detail: everything the desk needs on one screen. */
export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let booking: Awaited<ReturnType<typeof getBookingDetail>>;
  try {
    booking = await getBookingDetail(id, { kind: "staff" });
  } catch (error) {
    if (error instanceof BookingError && error.code === "booking_not_found") notFound();
    throw error;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{booking.bookingReference}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {bookingStatusLabel(booking.bookingStatus)} · payment {booking.paymentStatus} ·
            created {booking.createdAt.slice(0, 16).replace("T", " ")} UTC
            {booking.createdByName ? ` · by ${booking.createdByName}` : ""}
          </p>
        </div>
        <Link href="/admin/bookings" className="text-sm underline">
          ← All reservations
        </Link>
      </div>

      <BookingActions
        booking={{
          id: booking.id,
          bookingReference: booking.bookingReference,
          bookingStatus: booking.bookingStatus,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          adults: booking.adults,
          children: booking.children,
          currency: booking.currency,
          breakdown: booking.breakdown,
          rooms: booking.rooms.map((line) => ({
            roomId: line.roomId,
            roomNumber: line.roomNumber,
            roomTypeName: line.roomTypeName,
            nightlyRate: line.nightlyRate,
            nights: line.nights,
            roomTotal: line.roomTotal,
          })),
          allowedTransitions: booking.allowedTransitions,
          cancellation: {
            deadline: booking.cancellation.deadline,
            guestAllowed: booking.cancellation.guestAllowed,
            staffAllowed: booking.cancellation.staffAllowed,
          },
          notes: booking.notes,
          promotionCode: booking.promotionCode,
        }}
      />

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <h2 className="font-medium">Guest</h2>
        <p>
          {booking.guest.firstName} {booking.guest.lastName}
          {booking.guest.email ? ` · ${booking.guest.email}` : ""}
          {booking.guest.phone ? ` · ${booking.guest.phone}` : ""}
        </p>
        {booking.guest.idType && (
          <p>
            ID: {booking.guest.idType} {booking.guest.idNumber}
          </p>
        )}
        <p>
          Stay: {booking.checkIn} → {booking.checkOut} · {booking.nights}{" "}
          {booking.nights === 1 ? "night" : "nights"} · {booking.adults} adult
          {booking.adults === 1 ? "" : "s"}
          {booking.children > 0 ? `, ${booking.children} children` : ""}
        </p>
      </section>

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <h2 className="font-medium">Rooms & price</h2>
        <ul className="space-y-1">
          {booking.rooms.map((line) => (
            <li key={line.roomId}>
              {line.roomTypeName} · Room {line.roomNumber} — {formatMoney(line.nightlyRate, booking.currency)}
              /night × {line.nights} = {formatMoney(line.roomTotal, booking.currency)}
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t pt-2">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(booking.breakdown.subtotal, booking.currency)}</dd>
          </div>
          {Number(booking.breakdown.discount) > 0 && (
            <div className="flex justify-between">
              <dt>Discount{booking.promotionCode ? ` (${booking.promotionCode})` : ""}</dt>
              <dd>−{formatMoney(booking.breakdown.discount, booking.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxes</dt>
            <dd>{formatMoney(booking.breakdown.taxes, booking.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Fees</dt>
            <dd>{formatMoney(booking.breakdown.fees, booking.currency)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Total</dt>
            <dd>{formatMoney(booking.breakdown.total, booking.currency)}</dd>
          </div>
        </dl>
      </section>

      {booking.notes && (
        <section className="space-y-2 rounded-xl border p-4 text-sm">
          <h2 className="font-medium">Notes</h2>
          <pre className="whitespace-pre-wrap">{booking.notes}</pre>
        </section>
      )}

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <h2 className="font-medium">Activity</h2>
        {booking.activity.length === 0 && <p className="text-zinc-500">No recorded actions yet.</p>}
        <ul className="space-y-1">
          {booking.activity.map((entry) => (
            <li key={entry.id}>
              <span className="text-zinc-500">{entry.createdAt.slice(0, 16).replace("T", " ")}</span>{" "}
              {entry.action}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
