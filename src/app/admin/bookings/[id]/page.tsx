import { notFound } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatusBadge,
} from "@/components/admin/ui";
import { BookingActions } from "./booking-actions";
import { PaymentActions } from "./payment-actions";
import { BookingError, getBookingDetail } from "@/server/booking/service";
import { bookingStatusLabel } from "@/components/labels";
import { formatMoney } from "@/server/pricing/context";
import { getConsoleContext } from "@/server/console/context";
import { assertHotelAccess } from "@/server/auth/tenancy";

/** Staff reservation detail: everything the desk needs on one screen. */
export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member } = await getConsoleContext();

  let booking: Awaited<ReturnType<typeof getBookingDetail>>;
  try {
    booking = await getBookingDetail(id, { kind: "staff" });
    await assertHotelAccess(member, booking.hotelId);
  } catch (error) {
    if (error instanceof BookingError && error.code === "booking_not_found") notFound();
    throw error;
  }

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        backHref="/admin/bookings"
        backLabel="All reservations"
        eyebrow="Reservation"
        title={<span className="admin-mono">{booking.bookingReference}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={booking.bookingStatus}
              label={bookingStatusLabel(booking.bookingStatus)}
            />
            <span className="text-muted-foreground">payment</span>
            <StatusBadge status={booking.paymentStatus} />
            <span>
              created {booking.createdAt.slice(0, 16).replace("T", " ")} UTC
              {booking.createdByName ? ` · by ${booking.createdByName}` : ""}
            </span>
          </span>
        }
      />

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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Guest" />
          <CardBody className="space-y-2 text-sm">
            <p className="font-medium">
              {booking.guest.firstName} {booking.guest.lastName}
            </p>
            <p className="text-muted-foreground">
              {booking.guest.email ?? "no e-mail"} · {booking.guest.phone ?? "no phone"}
            </p>
            {booking.guest.idType && (
              <p>
                ID: {booking.guest.idType} {booking.guest.idNumber}
              </p>
            )}
            <p className="border-t border-[var(--admin-line)] pt-2">
              Stay: {booking.checkIn} → {booking.checkOut} · {booking.nights}{" "}
              {booking.nights === 1 ? "night" : "nights"} · {booking.adults} adult
              {booking.adults === 1 ? "" : "s"}
              {booking.children > 0 ? `, ${booking.children} children` : ""}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Rooms & price" />
          <CardBody className="space-y-3 text-sm">
            <ul className="space-y-1">
              {booking.rooms.map((line) => (
                <li key={line.roomId} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {line.roomTypeName} · Room {line.roomNumber}
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(line.nightlyRate, booking.currency)}/night × {line.nights}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(line.roomTotal, booking.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-[var(--admin-line)] pt-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatMoney(booking.breakdown.subtotal, booking.currency)}
                </dd>
              </div>
              {Number(booking.breakdown.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Discount{booking.promotionCode ? ` (${booking.promotionCode})` : ""}
                  </dt>
                  <dd className="tabular-nums">
                    −{formatMoney(booking.breakdown.discount, booking.currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxes</dt>
                <dd className="tabular-nums">
                  {formatMoney(booking.breakdown.taxes, booking.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fees</dt>
                <dd className="tabular-nums">
                  {formatMoney(booking.breakdown.fees, booking.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[var(--admin-line)] pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatMoney(booking.breakdown.total, booking.currency)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payments" />
          <CardBody>
            <PaymentActions
              bookingId={booking.id}
              paymentStatus={booking.paymentStatus}
              bookingStatus={booking.bookingStatus}
              payments={booking.payments}
              currency={booking.currency}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Activity" />
          <CardBody className="text-sm">
            {booking.activity.length === 0 && (
              <p className="text-muted-foreground">No recorded actions yet.</p>
            )}
            <ul className="space-y-1.5">
              {booking.activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-x-2">
                  <span className="text-xs text-muted-foreground">
                    {entry.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                  <span>{entry.action}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {booking.notes && (
        <Card>
          <CardHeader title="Notes" />
          <CardBody>
            <pre className="whitespace-pre-wrap text-sm">{booking.notes}</pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
