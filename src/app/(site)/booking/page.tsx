import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { PageHeading } from "@/components/hotel/shared";
import { BookingSummary, type SummaryRow } from "@/components/hotel/booking-summary";
import { CheckoutForm } from "./checkout-form";
import { getCurrentSession } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";
import { StaySearchSchema } from "@/server/availability/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import { buildQuote, QuoteError, type QuoteResult } from "@/server/pricing/service";
import { AvailabilityConflictError } from "@/server/availability/service";
import { getDefaultHotel, getPublishedHotelBySlug } from "@/server/public/hotels";
import { displayCurrency } from "@/server/currency/display";
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";
import { getT } from "@/server/locale/display";
import type { Dictionary } from "@/lib/dictionaries";

const RoomIdsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .refine((ids) => ids.length > 0, { message: "at least one room is required" })
  .refine(
    (ids) =>
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
      ),
    { message: "invalid room id" },
  );

/** Quote error codes → dictionary keys, translated at render. */
const QUOTE_ERROR_KEYS: Record<string, keyof Dictionary> = {
  promotion_not_found: "checkout.error.promotion_not_found",
  promotion_inactive: "checkout.error.promotion_inactive",
  promotion_expired: "checkout.error.promotion_expired",
  promotion_exhausted: "checkout.error.promotion_exhausted",
  too_many_rooms: "checkout.error.too_many_rooms",
  unavailable: "checkout.error.unavailable",
  room_not_found: "quote.error.room_not_found",
  invalid_date_range: "quote.error.invalid_date_range",
  stay_too_long: "quote.error.stay_too_long",
};

type Prefill = { firstName: string; lastName: string; email: string | null } | null;

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const display = await displayCurrency();
  const parsed = StaySearchSchema.safeParse({
    checkIn: sp.checkIn ?? undefined,
    checkOut: sp.checkOut ?? undefined,
    adults: sp.adults ?? undefined,
    children: sp.children ?? undefined,
  });
  const roomIds = sp.roomIds ? RoomIdsSchema.safeParse(sp.roomIds) : null;
  if (!parsed.success || !roomIds?.success) redirect("/search");

  const checkIn = parseDateOnly(parsed.data.checkIn);
  const checkOut = parseDateOnly(parsed.data.checkOut);
  if (!checkIn || !checkOut) redirect("/search");

  const adults = parsed.data.adults;
  const children = parsed.data.children;
  const selectedRoomIds = roomIds.data;

  // The property is derived from the selected rooms, never assumed from the
  // session or an untrusted body field. An explicit published slug wins.
  const roomHotel = await prisma.room.findFirst({
    where: { id: { in: selectedRoomIds } },
    select: { roomType: { select: { hotel: { select: { id: true } } } } },
  });
  const hotel = sp.hotel
    ? await getPublishedHotelBySlug(sp.hotel)
    : roomHotel
      ? await prisma.hotel.findFirst({
          where: {
            id: roomHotel.roomType.hotel.id,
            publicationStatus: "PUBLISHED",
            organization: { status: "ACTIVE" },
          },
        })
      : await getDefaultHotel();
  if (!hotel) redirect("/search");
  const searchHref = `/search?checkIn=${parsed.data.checkIn}&checkOut=${parsed.data.checkOut}&adults=${adults}&children=${children}&rooms=${selectedRoomIds.length}`;

  const session = await getCurrentSession();
  const t = await getT();
  const prefill: Prefill =
    session?.kind === "guest" && session.guestId
      ? await prisma.guest.findUnique({
          where: { id: session.guestId },
          select: { firstName: true, lastName: true, email: true },
        })
      : null;

  const promotionCode = sp.promotionCode?.trim() || null;

  let quote: QuoteResult | null = null;
  let failure: string | null = null;
  try {
    quote = await buildQuote({
      hotelId: hotel.id,
      checkIn,
      checkOut,
      adults,
      children,
      roomIds: selectedRoomIds,
      promotionCode,
    });
  } catch (error) {
    if (error instanceof QuoteError || error instanceof AvailabilityConflictError) {
      const code = error instanceof QuoteError ? error.code : "unavailable";
      failure = t(QUOTE_ERROR_KEYS[code] ?? "booking.failureFallback");
    } else {
      throw error;
    }
  }

  let summaryImage = fallbackImageForSlug(quote?.lines[0]?.roomTypeSlug ?? "");
  if (quote?.lines[0]) {
    const type = await prisma.roomType.findFirst({
      where: { slug: quote.lines[0].roomTypeSlug, hotelId: hotel.id },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    if (type?.images[0]) summaryImage = type.images[0].url;
  }

  const summaryRows: SummaryRow[] = quote
    ? [
        ...quote.lines.map((line) => ({
          label: t("booking.lineRow", {
            type: line.roomTypeName,
            number: line.roomNumber,
          }),
          value: formatMoney(line.roomTotal, quote.currency, display),
        })),
        ...(Number(quote.breakdown.discount) > 0
          ? [
              {
                label: quote.promotion
                  ? t("booking.discountCode", { code: quote.promotion.code })
                  : t("booking.discount"),
                value: `−${formatMoney(quote.breakdown.discount, quote.currency, display)}`,
              },
            ]
          : []),
        { label: t("booking.taxes"), value: formatMoney(quote.breakdown.taxes, quote.currency, display) },
        { label: t("booking.serviceFee"), value: formatMoney(quote.breakdown.fees, quote.currency, display) },
      ]
    : [];

  return (
    <div className="container page-content checkout-page">
      <Link href={searchHref} className="text-link">
        <ChevronLeft size={16} />
        {t("booking.backToRooms")}
      </Link>
      <PageHeading
        eyebrow={t("booking.eyebrow")}
        title={t("booking.title")}
        description={t("booking.description")}
      />

      {failure && (
        <div className="form-section">
          <h2>{t("booking.failureTitle")}</h2>
          <p>{failure}</p>
          <ButtonLink href={searchHref}>{t("booking.searchOther")}</ButtonLink>
        </div>
      )}

      {quote && (
        <div className="checkout-layout">
          <CheckoutForm
            stay={{
              hotelId: hotel.id,
              checkIn: quote.checkIn,
              checkOut: quote.checkOut,
              adults: quote.adults,
              children: quote.children,
              roomIds: selectedRoomIds,
            }}
            quote={{
              currency: quote.currency,
              nights: quote.nights,
              lines: quote.lines.map((line) => ({
                roomId: line.roomId,
                roomNumber: line.roomNumber,
                roomTypeName: line.roomTypeName,
                nightlyRate: line.nightlyRate,
                nights: line.nights,
                roomTotal: line.roomTotal,
                perNight: line.perNight,
              })),
              promotion: quote.promotion
                ? { code: quote.promotion.code, discount: quote.promotion.discount }
                : null,
              breakdown: quote.breakdown,
              policy: quote.policy,
            }}
            promotionCode={promotionCode}
            prefill={prefill}
          />

          <BookingSummary
            image={summaryImage}
            title={
              quote.lines.length === 1
                ? quote.lines[0].roomTypeName
                : t("booking.moreRooms", {
                    type: quote.lines[0].roomTypeName,
                    count: quote.lines.length - 1,
                  })
            }
            checkIn={quote.checkIn}
            checkOut={quote.checkOut}
            guests={t("booking.guestsLine", {
              adults: quote.adults,
              adultUnit: quote.adults === 1 ? t("search.adult") : t("search.adultsPlural"),
              children: quote.children,
              childUnit: quote.children === 1 ? t("search.child") : t("search.childrenPlural"),
              rooms: quote.lines.length,
              roomUnit: quote.lines.length === 1 ? t("summary.room") : t("summary.rooms"),
            })}
            rows={summaryRows}
            total={quote.breakdown.total}
            currency={quote.currency}
            displayCurrency={display}
            note={t("policy.freeCancellationCheckIn", {
              hours: quote.policy.cancellationWindowHours,
            })}
            changeHref={searchHref}
          />
        </div>
      )}
    </div>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-link">
      {children}
    </Link>
  );
}
