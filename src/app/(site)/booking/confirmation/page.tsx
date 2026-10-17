import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingSummary, type SummaryRow } from "@/components/hotel/booking-summary";
import { CancelReservationButton } from "@/components/hotel/cancel-button";
import { PrintButton } from "@/components/hotel/print-button";
import { getCurrentSession } from "@/server/auth/dal";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import {
  BookingError,
  getBookingDetailByReference,
  type BookingViewer,
} from "@/server/booking/service";
import { prisma } from "@/lib/prisma";
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const reference = sp.ref?.trim();

  if (!reference) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h2>Booking confirmation</h2>
          <p>No reservation reference was provided.</p>
          <Button asChild>
            <Link href="/">Back to the hotel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const claim = await verifyBookingClaim(cookieStore.get(BOOKING_CLAIM_COOKIE)?.value);
  const session = await getCurrentSession();

  let viewer: BookingViewer | null = null;
  let mode: "account" | "claim" = "claim";
  if (claim && claim.reference === reference) {
    viewer = { kind: "guest", guestId: claim.guestId };
  } else if (session?.kind === "guest" && session.guestId) {
    viewer = { kind: "guest", guestId: session.guestId };
    mode = "account";
  }

  let detail: Awaited<ReturnType<typeof getBookingDetailByReference>> | null = null;
  if (viewer) {
    try {
      detail = await getBookingDetailByReference(reference, viewer);
    } catch (error) {
      if (!(error instanceof BookingError && error.code === "booking_not_found")) throw error;
    }
  }

  if (!detail) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h2>We couldn&apos;t find that reservation.</h2>
          <p>Reservation {reference} is not available for this browser or account.</p>
          <Button asChild>
            <Link href="/search">Search rooms</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cancelled = detail.bookingStatus === "CANCELLED";
  const type = detail.rooms[0]
    ? await prisma.roomType.findFirst({
        where: { name: detail.rooms[0].roomTypeName },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      })
    : null;
  const image = type?.images[0]?.url ?? fallbackImageForSlug(type?.slug ?? "");

  const rows: SummaryRow[] = [
    ...detail.rooms.map((room) => ({
      label: `${room.roomTypeName} · Room ${room.roomNumber}`,
      value: formatMoney(room.roomTotal, detail.currency),
    })),
    ...(Number(detail.breakdown.discount) > 0
      ? [
          {
            label: "Discount",
            value: `−${formatMoney(detail.breakdown.discount, detail.currency)}`,
          },
        ]
      : []),
    { label: "Taxes", value: formatMoney(detail.breakdown.taxes, detail.currency) },
    { label: "Service fee", value: formatMoney(detail.breakdown.fees, detail.currency) },
  ];

  return (
    <div className="container page-content confirmation-page">
      <div className="confirmation-heading">
        <span className="success-icon">
          <Check />
        </span>
        <span className="eyebrow">
          {cancelled ? "RESERVATION CANCELLED" : "SOMETHING TO LOOK FORWARD TO"}
        </span>
        <h1>{cancelled ? "Your reservation was cancelled." : "Your Stay at Santo Hotel"}</h1>
        <p>
          {cancelled
            ? "We hope to welcome you another time."
            : "A little escape, thoughtfully put together."}
        </p>
        <span className="subtle-badge">
          Reference {detail.bookingReference} · {detail.bookingStatus}
        </span>
      </div>

      <div className="checkout-layout">
        <section className="form-section">
          <span className="eyebrow">RESERVATION DETAILS</span>
          <h2>{detail.bookingReference}</h2>
          <div className="review-details">
            <span>
              Guest<strong>{detail.guestName}</strong>
            </span>
            <span>
              Stay<strong>{detail.checkIn} → {detail.checkOut}</strong>
            </span>
            <span>
              Party<strong>{detail.adults} adult{detail.adults === 1 ? "" : "s"}{detail.children > 0 ? ` · ${detail.children} children` : ""}</strong>
            </span>
            <span>
              Payment status<strong>{detail.paymentStatus}</strong>
            </span>
            <span>
              Cancellation
              <strong>
                {detail.cancellation.deadline
                  ? `Until ${detail.cancellation.deadline.slice(0, 16).replace("T", " ")} UTC`
                  : "Contact the hotel"}
              </strong>
            </span>
          </div>

          <div className="info-notice">
            <Check />
            <p>
              {cancelled
                ? "This reservation has been cancelled and no further action is required."
                : detail.paymentStatus === "PAID"
                  ? "Your reservation is paid in full. We look forward to welcoming you."
                  : "Your reservation is held. Complete payment to confirm your stay."}
            </p>
          </div>

          {!cancelled && detail.paymentStatus !== "PAID" && (
            <Button asChild>
              <Link href={`/pay/${encodeURIComponent(detail.bookingReference)}`}>
                Pay {formatMoney(detail.breakdown.total, detail.currency)} now <ArrowRight />
              </Link>
            </Button>
          )}

          {!cancelled && detail.cancellation.guestAllowed && (
            <div className="confirmation-actions">
              <CancelReservationButton
                bookingId={detail.id}
                reference={detail.bookingReference}
                mode={mode}
              />
            </div>
          )}

          {detail.notes && (
            <>
              <h3>Your requests</h3>
              <p className="tiny-note">{detail.notes}</p>
            </>
          )}

          <div className="confirmation-actions">
            <Button asChild variant="outline">
              <Link href="/account">View my bookings</Link>
            </Button>
            <PrintButton />
          </div>
          <Link href="/" className="text-link">
            Return to homepage
          </Link>
        </section>

        <BookingSummary
          image={image}
          title={detail.rooms.map((room) => room.roomTypeName).join(" + ")}
          checkIn={detail.checkIn}
          checkOut={detail.checkOut}
          guests={`${detail.adults} adult${detail.adults === 1 ? "" : "s"}${detail.children > 0 ? ` · ${detail.children} children` : ""} · ${detail.rooms.length} room${detail.rooms.length === 1 ? "" : "s"}`}
          rows={rows}
          total={detail.breakdown.total}
          currency={detail.currency}
          note={
            detail.cancellation.deadline
              ? `Free cancellation until ${detail.cancellation.deadline.slice(0, 16).replace("T", " ")} UTC.`
              : "Cancellation terms are confirmed by the hotel."
          }
        />
      </div>
    </div>
  );
}
