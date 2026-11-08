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
import { displayCurrency } from "@/server/currency/display";
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";
import { getT } from "@/server/locale/display";
import type { Dictionary } from "@/lib/dictionaries";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const display = await displayCurrency();
  const t = await getT();
  const reference = sp.ref?.trim();

  if (!reference) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h2>{t("confirmation.emptyTitle")}</h2>
          <p>{t("confirmation.emptyBody")}</p>
          <Button asChild>
            <Link href="/">{t("confirmation.backHome")}</Link>
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
          <h2>{t("confirmation.notFoundTitle")}</h2>
          <p>{t("confirmation.notFoundBody", { ref: reference })}</p>
          <Button asChild>
            <Link href="/search">{t("confirmation.searchRooms")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cancelled = detail.bookingStatus === "CANCELLED";
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
    ...(Number(detail.breakdown.discount) > 0
      ? [
          {
            label: t("booking.discount"),
            value: `−${formatMoney(detail.breakdown.discount, detail.currency, display)}`,
          },
        ]
      : []),
    { label: t("booking.taxes"), value: formatMoney(detail.breakdown.taxes, detail.currency, display) },
    { label: t("booking.serviceFee"), value: formatMoney(detail.breakdown.fees, detail.currency, display) },
  ];

  const statusLabel = t(`status.booking.${detail.bookingStatus}` as keyof Dictionary);
  const paymentLabel = t(`status.payment.${detail.paymentStatus}` as keyof Dictionary);

  return (
    <div className="container page-content confirmation-page">
      <div className="confirmation-heading">
        <span className="success-icon">
          <Check />
        </span>
        <span className="eyebrow">
          {cancelled ? t("confirmation.eyebrow.cancelled") : t("confirmation.eyebrow.success")}
        </span>
        <h1>
          {cancelled ? t("confirmation.title.cancelled") : t("confirmation.title.success")}
        </h1>
        <p>
          {cancelled ? t("confirmation.body.cancelled") : t("confirmation.body.success")}
        </p>
        <span className="subtle-badge">
          {t("confirmation.referenceBadge", {
            ref: detail.bookingReference,
            status: statusLabel,
          })}
        </span>
      </div>

      <div className="checkout-layout">
        <section className="form-section">
          <span className="eyebrow">{t("confirmation.detailsEyebrow")}</span>
          <h2>{detail.bookingReference}</h2>
          <div className="review-details">
            <span>
              {t("confirmation.guest")}<strong>{detail.guestName}</strong>
            </span>
            <span>
              {t("confirmation.stay")}<strong>{detail.checkIn} → {detail.checkOut}</strong>
            </span>
            <span>
              {t("confirmation.party")}
              <strong>
                {detail.adults}{" "}
                {detail.adults === 1 ? t("search.adult") : t("search.adultsPlural")}
                {detail.children > 0
                  ? ` · ${detail.children} ${
                      detail.children === 1 ? t("search.child") : t("search.childrenPlural")
                    }`
                  : ""}
              </strong>
            </span>
            <span>
              {t("confirmation.paymentStatus")}<strong>{paymentLabel}</strong>
            </span>
            <span>
              {t("confirmation.cancellation")}
              <strong>
                {detail.cancellation.deadline
                  ? t("confirmation.until", {
                      when: detail.cancellation.deadline.slice(0, 16).replace("T", " "),
                    })
                  : t("account.contactHotel")}
              </strong>
            </span>
          </div>

          <div className="info-notice">
            <Check />
            <p>
              {cancelled
                ? t("confirmation.cancelledNotice")
                : detail.paymentStatus === "PAID"
                  ? t("confirmation.paidNotice")
                  : t("confirmation.heldNotice")}
            </p>
          </div>

          {!cancelled && detail.paymentStatus !== "PAID" && (
            <Button asChild>
              <Link href={`/pay/${encodeURIComponent(detail.bookingReference)}`}>
                {t("confirmation.payNow", {
                  amount: formatMoney(detail.breakdown.total, detail.currency, display),
                })}{" "}
                <ArrowRight />
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
              <h3>{t("confirmation.yourRequests")}</h3>
              <p className="tiny-note">{detail.notes}</p>
            </>
          )}

          <div className="confirmation-actions">
            <Button asChild variant="outline">
              <Link href="/account">{t("confirmation.viewBookings")}</Link>
            </Button>
            <PrintButton />
          </div>
          <Link href="/" className="text-link">
            {t("confirmation.returnHome")}
          </Link>
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
          note={
            detail.cancellation.deadline
              ? t("confirmation.freeCancellationUntil", {
                  when: detail.cancellation.deadline.slice(0, 16).replace("T", " "),
                })
              : t("confirmation.cancellationTerms")
          }
        />
      </div>
    </div>
  );
}
