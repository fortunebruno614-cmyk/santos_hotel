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
import { displayCurrency } from "@/server/currency/display";
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";
import { getT } from "@/server/locale/display";

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const display = await displayCurrency();
  const t = await getT();

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
        where: { name: detail.rooms[0].roomTypeName, hotelId: detail.hotelId },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      })
    : null;
  const image = type?.images[0]?.url ?? fallbackImageForSlug(type?.slug ?? "");

  const rows: SummaryRow[] = [
    ...detail.rooms.map((room) => ({
      label: t("booking.lineRow", {
        type: room.roomTypeName,
        number: room.roomNumber,
      }),
      value: formatMoney(room.roomTotal, detail.currency, display),
    })),
    { label: t("booking.taxes"), value: formatMoney(detail.breakdown.taxes, detail.currency, display) },
    { label: t("booking.serviceFee"), value: formatMoney(detail.breakdown.fees, detail.currency, display) },
  ];

  return (
    <div className="container page-content checkout-page">
      <Link href={`/booking/confirmation?ref=${encodeURIComponent(reference)}`} className="text-link">
        <ChevronLeft size={16} />
        {t("pay.backToConfirmation")}
      </Link>
      <PageHeading
        eyebrow={t("pay.eyebrow")}
        title={
          paid
            ? t("pay.title.paid")
            : cancelled
              ? t("pay.title.cancelled")
              : t("pay.title.due")
        }
        description={t("pay.description", {
          ref: detail.bookingReference,
          checkIn: detail.checkIn,
          checkOut: detail.checkOut,
        })}
      />

      <div className="checkout-layout">
        <section className="form-section">
          <span className="eyebrow">{t("pay.amountDue")}</span>
          <h2>{formatMoney(detail.breakdown.total, detail.currency, display)}</h2>
          <p>
            {detail.nights} {detail.nights === 1 ? t("room.night") : t("room.nights")} ·{" "}
            {detail.adults}{" "}
            {detail.adults === 1 ? t("search.adult") : t("search.adultsPlural")}
            {detail.children > 0
              ? `, ${detail.children} ${
                  detail.children === 1 ? t("search.child") : t("search.childrenPlural")
                }`
              : ""}
          </p>

          {payable ? (
            <>
              <div className="info-notice">
                <ShieldCheck />
                <div>
                  <strong>{t("pay.secureTitle")}</strong>
                  <p>{t("pay.secureBody")}</p>
                </div>
              </div>
              <PayButtons bookingId={detail.id} reference={detail.bookingReference} />
            </>
          ) : (
            <div className="info-notice">
              <ShieldCheck />
              <p>{paid ? t("pay.paidNotice") : t("pay.cancelledNotice")}</p>
            </div>
          )}
        </section>

        <BookingSummary
          image={image}
          title={detail.rooms.map((room) => room.roomTypeName).join(" + ")}
          checkIn={detail.checkIn}
          checkOut={detail.checkOut}
          guests={t("booking.guestsLine", {
            adults: detail.adults,
            adultUnit: detail.adults === 1 ? t("search.adult") : t("search.adultsPlural"),
            children: detail.children,
            childUnit: detail.children === 1 ? t("search.child") : t("search.childrenPlural"),
            rooms: detail.rooms.length,
            roomUnit: detail.rooms.length === 1 ? t("summary.room") : t("summary.rooms"),
          })}
          rows={rows}
          total={detail.breakdown.total}
          currency={detail.currency}
          displayCurrency={display}
          note={t("pay.note")}
        />
      </div>
    </div>
  );
}
