import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StaySearchSchema } from "@/server/availability/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import { findAvailability, StayValidationError } from "@/server/availability/service";
import { computeTypePrices } from "@/server/pricing/service";
import { loadHotelContext } from "@/server/pricing/context";

/**
 * Public search (`/search` is public in src/config/access-map.ts).
 *
 * Enter dates → eligible room types with the rooms still free (P4 engine) and a
 * server-priced stay total (P5 pricing). "Book" carries the stay and one free
 * room id to `/booking`, where the price is quoted again and re-checked inside
 * the checkout transaction.
 */

function defaultDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_query: "Please choose valid dates and party size.",
  invalid_date_range: "Check-out must be after check-in.",
  stay_too_long: "That stay is longer than the 60-night limit.",
  invalid_occupancy: "Party size must be 1–20 adults and 0–20 children.",
};

export default async function SearchPage({
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

  let errorMessage: string | null = null;
  if (sp.checkIn || sp.checkOut || sp.adults || sp.children) {
    if (!parsed.success) {
      const key = Object.keys(parsed.error.flatten().fieldErrors)[0];
      errorMessage = ERROR_MESSAGES[key] ?? ERROR_MESSAGES.invalid_query;
    }
  }

  const stay = (() => {
    if (!parsed.success) return null;
    const checkIn = parseDateOnly(parsed.data.checkIn);
    const checkOut = parseDateOnly(parsed.data.checkOut);
    if (!checkIn || !checkOut) return null;
    return {
      checkIn,
      checkOut,
      adults: parsed.data.adults,
      children: parsed.data.children,
    };
  })();

  let results: Awaited<ReturnType<typeof findAvailability>> | null = null;
  let prices = new Map<string, { perNight: string[]; nightlyRate: string; stayTotal: string; currency: string }>();
  let hotel: Awaited<ReturnType<typeof loadHotelContext>> | null = null;

  if (stay) {
    try {
      hotel = await loadHotelContext();
      results = await findAvailability(stay);
      prices = await computeTypePrices(
        results.roomTypes.map((type) => type.id),
        stay.checkIn,
        stay.checkOut,
      );
    } catch (error) {
      if (error instanceof StayValidationError) {
        errorMessage = ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.invalid_query;
      } else {
        throw error;
      }
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Find a room</h1>
          <form method="GET" action="/search" className="grid gap-4 sm:grid-cols-5">
            <div className="space-y-1">
              <label htmlFor="checkIn" className="text-sm font-medium">
                Check-in
              </label>
              <input
                id="checkIn"
                name="checkIn"
                type="date"
                required
                defaultValue={parsed.success ? parsed.data.checkIn : defaultDate(7)}
                className="w-full border px-3 py-2 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="checkOut" className="text-sm font-medium">
                Check-out
              </label>
              <input
                id="checkOut"
                type="date"
                name="checkOut"
                required
                defaultValue={parsed.success ? parsed.data.checkOut : defaultDate(9)}
                className="w-full border px-3 py-2 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="adults" className="text-sm font-medium">
                Adults
              </label>
              <input
                id="adults"
                name="adults"
                type="number"
                min={1}
                max={20}
                defaultValue={parsed.success ? parsed.data.adults : 2}
                className="w-full border px-3 py-2 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="children" className="text-sm font-medium">
                Children
              </label>
              <input
                id="children"
                name="children"
                type="number"
                min={0}
                max={20}
                defaultValue={parsed.success ? parsed.data.children : 0}
                className="w-full border px-3 py-2 rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full border px-3 py-2 rounded-md font-medium"
              >
                Search
              </button>
            </div>
          </form>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </section>

        {stay && results && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">
              Available {results.nights} {results.nights === 1 ? "night" : "nights"} ·{" "}
              {stay.checkIn.toISOString().slice(0, 10)} → {stay.checkOut.toISOString().slice(0, 10)}
            </h2>

            {!results.hasAvailability && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No rooms are free for those dates — try a different window.
              </p>
            )}

            <ul className="space-y-3">
              {results.roomTypes.map((type) => {
                const price = prices.get(type.id);
                const firstRoom = type.availableRooms[0];
                const bookHref = firstRoom
                  ? `/booking?checkIn=${stay.checkIn.toISOString().slice(0, 10)}` +
                    `&checkOut=${stay.checkOut.toISOString().slice(0, 10)}` +
                    `&adults=${stay.adults}&children=${stay.children}&roomIds=${firstRoom.id}`
                  : "/search";
                return (
                  <li
                    key={type.id}
                    className="flex flex-col gap-3 rounded-xl border border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/15"
                  >
                    <div>
                      <h3 className="font-medium">{type.name}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Sleeps {type.maxAdults}
                        {type.maxChildren > 0 ? ` + ${type.maxChildren} children` : ""} ·{" "}
                        {type.availableCount} of {type.totalRooms} rooms free
                      </p>
                      {price && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">
                            {price.currency} {price.stayTotal}
                          </span>{" "}
                          for {results.nights} {results.nights === 1 ? "night" : "nights"} (
                          {price.currency} {price.nightlyRate}/night avg.)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {type.availableCount > 0 ? (
                        <Link
                          href={bookHref}
                          className="inline-block border px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Book
                        </Link>
                      ) : (
                        <span className="text-sm text-zinc-500">Sold out</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="text-sm text-zinc-500">
              {hotel ? `${hotel.name} · check-in from ${hotel.checkInTime}, check-out by ${hotel.checkOutTime}` : null}
            </p>
          </section>
        )}
      </main>
    </>
  );
}
