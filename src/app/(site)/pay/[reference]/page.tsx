import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/hotel/shared";
import { BookingSummary, type SummaryRow } from "@/components/hotel/booking-summary";
import { PayButtons } from "./pay-buttons";
import { getCurrentSession } from "@/server/auth/dal";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import {
  BookingError,
  getBookingDetailByReference,
  type BookingViewer,
} from "@/server/booking/service";
import { prisma } from "@/lib/prisma";
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  const cookieStore = await cookies();
  const claim = await verifyBookingClaim(cookieStore.get(BOOKING_CLAIM_COOKIE)?.value);
  const session = await getCurrentSession();

  let viewer: BookingViewer | null = null;
  if (claim && claim.reference === reference) {
    viewer = { kind: "guest", guestId: claim.guestId };
  } else if (session?.kind === "guest" && session.guestId) {
    viewer = { kind: "guest", guestId: session.guestId };
  }
  if (!viewer) notFound();

  let detail: Awaited<ReturnType<typeof getBookingDetailByReference>> | null = null;
  try {
    detail = await getBookingDetailByReference(reference, viewer);
  } catch (error) {
    if (error instanceof BookingError && error.code === "booking_not_found") notFound();
    throw error;
  }

  const paid = detail.paymentStatus === "PAID";
  const cancelled = detail.bookingStatus === "CANCELLED";
  const payable = !paid && !cancelled;

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
    { label: "Taxes", value: formatMoney(detail.breakdown.taxes, detail.currency) },
    { label: "Service fee", value: formatMoney(detail.breakdown.fees, detail.currency) },
  ];

  return (
    <div className="container page-content checkout-page">
      <Link href={`/booking/confirmation?ref=${encodeURIComponent(reference)}`} className="text-link">
        <ChevronLeft size={16} />
        Back to confirmation
      </Link>
      <PageHeading
        eyebrow="SECURE PAYMENT"
        title={paid ? "This reservation is paid." : cancelled ? "This reservation was cancelled." : "Complete your payment."}
        description={`Reservation ${detail.bookingReference} · ${detail.checkIn} → ${detail.checkOut}`}
      />

      <div className="checkout-layout">
        <section className="form-section">
          <span className="eyebrow">AMOUNT DUE</span>
          <h2>{formatMoney(detail.breakdown.total, detail.currency)}</h2>
          <p>
            {detail.nights} {detail.nights === 1 ? "night" : "nights"} · {detail.adults} adult
            {detail.adults === 1 ? "" : "s"}
            {detail.children > 0 ? `, ${detail.children} children` : ""}
          </p>

          {payable ? (
            <>
              <div className="info-notice">
                <ShieldCheck />
                <div>
                  <strong>Secure payment</strong>
                  <p>
                    Complete your payment to confirm the reservation. Your rooms are held while
                    payment is processed.
                  </p>
                </div>
              </div>
              <PayButtons bookingId={detail.id} reference={detail.bookingReference} />
            </>
          ) : (
            <div className="info-notice">
              <ShieldCheck />
              <p>
                {paid
                  ? "No further payment is due. We look forward to welcoming you."
                  : "This reservation has been cancelled and cannot be paid online."}
              </p>
            </div>
          )}
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
          note="Payment is processed through the hotel's secure payment page."
        />
      </div>
    </div>
  );
}
