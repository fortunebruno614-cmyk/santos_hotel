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
import { fallbackImageForSlug, formatMoney } from "@/lib/hotel";

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

const QUOTE_ERROR_MESSAGES: Record<string, string> = {
  promotion_not_found: "That promotion code does not exist.",
  promotion_inactive: "That promotion is not currently active.",
  promotion_expired: "That promotion is no longer valid.",
  promotion_exhausted: "That promotion has been fully redeemed.",
  too_many_rooms: "That is more rooms than a single reservation may hold.",
  unavailable: "Those rooms are no longer available for your dates.",
  room_not_found: "One of the selected rooms no longer exists.",
  invalid_date_range: "Check-out must be after check-in.",
  stay_too_long: "That stay is longer than the 60-night limit.",
};

type Prefill = { firstName: string; lastName: string; email: string | null } | null;

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
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
  const searchHref = `/search?checkIn=${parsed.data.checkIn}&checkOut=${parsed.data.checkOut}&adults=${adults}&children=${children}&rooms=${selectedRoomIds.length}`;

  const session = await getCurrentSession();
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
      failure = QUOTE_ERROR_MESSAGES[code] ?? "Those rooms cannot be booked for the selected dates.";
    } else {
      throw error;
    }
  }

  let summaryImage = fallbackImageForSlug(quote?.lines[0]?.roomTypeSlug ?? "");
  if (quote?.lines[0]) {
    const type = await prisma.roomType.findUnique({
      where: { slug: quote.lines[0].roomTypeSlug },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    if (type?.images[0]) summaryImage = type.images[0].url;
  }

  const summaryRows: SummaryRow[] = quote
    ? [
        ...quote.lines.map((line) => ({
          label: `${line.roomTypeName} · Room ${line.roomNumber}`,
          value: formatMoney(line.roomTotal, quote.currency),
        })),
        ...(Number(quote.breakdown.discount) > 0
          ? [
              {
                label: `Discount${quote.promotion ? ` (${quote.promotion.code})` : ""}`,
                value: `−${formatMoney(quote.breakdown.discount, quote.currency)}`,
              },
            ]
          : []),
        { label: "Taxes", value: formatMoney(quote.breakdown.taxes, quote.currency) },
        { label: "Service fee", value: formatMoney(quote.breakdown.fees, quote.currency) },
      ]
    : [];

  return (
    <div className="container page-content checkout-page">
      <Link href={searchHref} className="text-link">
        <ChevronLeft size={16} />
        Back to rooms
      </Link>
      <PageHeading
        eyebrow="A FEW THOUGHTFUL DETAILS"
        title="Your stay, coming together."
        description="Review your selection and complete your guest details. Your reservation is confirmed before payment."
      />

      {failure && (
        <div className="form-section">
          <h2>We couldn&apos;t hold those rooms.</h2>
          <p>{failure}</p>
          <ButtonLink href={searchHref}>Search other rooms</ButtonLink>
        </div>
      )}

      {quote && (
        <div className="checkout-layout">
          <CheckoutForm
            stay={{
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
                : `${quote.lines[0].roomTypeName} + ${quote.lines.length - 1} more`
            }
            checkIn={quote.checkIn}
            checkOut={quote.checkOut}
            guests={`${quote.adults} adult${quote.adults === 1 ? "" : "s"}${
              quote.children > 0 ? ` · ${quote.children} children` : ""
            } · ${quote.lines.length} room${quote.lines.length === 1 ? "" : "s"}`}
            rows={summaryRows}
            total={quote.breakdown.total}
            currency={quote.currency}
            note={`Free cancellation up to ${quote.policy.cancellationWindowHours} hours before check-in.`}
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
