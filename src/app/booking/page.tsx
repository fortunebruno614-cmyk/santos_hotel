import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { CheckoutForm } from "./checkout-form";
import { getCurrentSession } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";
import { StaySearchSchema } from "@/server/availability/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import { buildQuote, QuoteError, type QuoteResult } from "@/server/pricing/service";
import { AvailabilityConflictError } from "@/server/availability/service";
import { formatMoney } from "@/server/pricing/context";

/**
 * Public checkout (`/booking`). Everything here is read-only: the page prices
 * the requested allocation with the same `computeQuote` the API uses, then the
 * client form posts to `/api/public/checkout`, where availability and price are
 * re-checked inside the booking transaction before anything is stored.
 */

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

/** Quote + form side by side (extracted so `quote` stays non-null inside maps). */
function BookingPanels({
  quote,
  roomIds,
  promotionCode,
  prefill,
}: {
  quote: QuoteResult;
  roomIds: string[];
  promotionCode: string | null;
  prefill: Prefill;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="font-medium">
          {quote.nights} {quote.nights === 1 ? "night" : "nights"} · {quote.checkIn} →{" "}
          {quote.checkOut} · {quote.adults} adult{quote.adults === 1 ? "" : "s"}
          {quote.children > 0 ? `, ${quote.children} children` : ""}
        </h2>

        <ul className="space-y-3 text-sm">
          {quote.lines.map((line) => (
            <li
              key={line.roomId}
              className="rounded-lg border border-black/10 p-3 dark:border-white/15"
            >
              <p className="font-medium">
                {line.roomTypeName} · Room {line.roomNumber}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {line.perNight.map((amount) => formatMoney(amount, quote.currency)).join(" + ")}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {line.nights} {line.nights === 1 ? "night" : "nights"} ={" "}
                <span className="font-medium">{formatMoney(line.roomTotal, quote.currency)}</span>
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-black/10 pt-3 text-sm dark:border-white/15">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(quote.breakdown.subtotal, quote.currency)}</dd>
          </div>
          {Number(quote.breakdown.discount) > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Discount{quote.promotion ? ` (${quote.promotion.code})` : ""}</dt>
              <dd>−{formatMoney(quote.breakdown.discount, quote.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxes</dt>
            <dd>{formatMoney(quote.breakdown.taxes, quote.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Service fee</dt>
            <dd>{formatMoney(quote.breakdown.fees, quote.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/10 pt-2 font-medium dark:border-white/15">
            <dt>Total</dt>
            <dd>{formatMoney(quote.breakdown.total, quote.currency)}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          {quote.hotel.name} · check-in from {quote.hotel.checkInTime}, check-out by{" "}
          {quote.hotel.checkOutTime}
        </p>
      </section>

      <section className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <CheckoutForm
          stay={{
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            adults: quote.adults,
            children: quote.children,
            roomIds,
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
      </section>
    </div>
  );
}

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
  const searchHref = `/search?checkIn=${parsed.data.checkIn}&checkOut=${parsed.data.checkOut}&adults=${adults}&children=${children}`;

  const session = await getCurrentSession();
  const prefill =
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Complete your booking</h1>
          <Link href={searchHref} className="text-sm underline">
            ← Change search
          </Link>
        </div>

        {failure && (
          <div className="space-y-2 rounded-xl border border-red-300 p-5">
            <p className="text-sm text-red-600">{failure}</p>
            <Link href={searchHref} className="text-sm underline">
              Search other rooms
            </Link>
          </div>
        )}

        {quote && (
          <BookingPanels
            quote={quote}
            roomIds={selectedRoomIds}
            promotionCode={promotionCode}
            prefill={prefill}
          />
        )}
      </main>
    </>
  );
}
