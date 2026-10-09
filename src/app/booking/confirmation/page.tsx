import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { CancelReservationButton } from "./cancel-button";
import { getCurrentSession } from "@/server/auth/dal";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import {
  BookingError,
  getBookingDetailByReference,
  type BookingViewer,
} from "@/server/booking/service";
import { formatMoney } from "@/server/pricing/context";

/**
 * Post-checkout confirmation (`/booking/confirmation?ref=SH-2026-000042`).
 *
 * Access: the signed `booking_claim` cookie minted at checkout (guests who never
 * made an account) or a signed-in guest session that owns the reservation.
 * Anything else is simply "not found" — the page never confirms a reference to
 * a stranger.
 */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const reference = sp.ref?.trim();
  if (!reference) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl space-y-4 p-6">
          <h1 className="text-2xl font-semibold">Booking confirmation</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No reservation reference was provided.
          </p>
          <Link href="/" className="text-sm underline">
            Back to the hotel
          </Link>
        </main>
      </>
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

  const denied = (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Booking confirmation</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We could not find reservation {reference} for this browser or account.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/" className="underline">
            Home
          </Link>
          <Link href="/search" className="underline">
            Search rooms
          </Link>
        </div>
      </main>
    </>
  );
  if (!detail) return denied;

  const cancelled = detail.bookingStatus === "CANCELLED";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {cancelled ? "Reservation cancelled" : "You're booked"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Reference <span className="font-mono">{detail.bookingReference}</span> · status{" "}
            {detail.bookingStatus}
          </p>
        </div>

        <section className="space-y-2 rounded-xl border border-black/10 p-5 text-sm dark:border-white/15">
          <h2 className="font-medium">Stay</h2>
          <p>
            {detail.checkIn} → {detail.checkOut} · {detail.nights}{" "}
            {detail.nights === 1 ? "night" : "nights"} · {detail.adults} adult
            {detail.adults === 1 ? "" : "s"}
            {detail.children > 0 ? `, ${detail.children} children` : ""}
          </p>
          <ul className="space-y-1">
            {detail.rooms.map((room) => (
              <li key={room.roomId}>
                {room.roomTypeName} · Room {room.roomNumber} · {detail.currency} {room.roomTotal}
              </li>
            ))}
          </ul>
          <p className="border-t border-black/10 pt-2 font-medium dark:border-white/15">
            Total {formatMoney(detail.breakdown.total, detail.currency)}
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-medium">Payment</h2>
          {cancelled ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              {detail.paymentStatus === "REFUNDED"
                ? "This reservation was refunded."
                : `Payment status: ${detail.paymentStatus}.`}
            </p>
          ) : detail.paymentStatus === "PAID" ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              Paid in full — no further action needed.
            </p>
          ) : (
            <>
              <p className="text-zinc-600 dark:text-zinc-400">
                Payment is still due ({detail.paymentStatus.toLowerCase()}). Complete it to
                confirm the reservation.
              </p>
              <Link
                href={`/pay/${encodeURIComponent(detail.bookingReference)}`}
                className="inline-block rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Pay {formatMoney(detail.breakdown.total, detail.currency)} now
              </Link>
            </>
          )}
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-medium">Cancellation</h2>
          {cancelled ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              This reservation has been cancelled.
            </p>
          ) : detail.cancellation.guestAllowed ? (
            <>
              <p className="text-zinc-600 dark:text-zinc-400">
                Free cancellation until{" "}
                {detail.cancellation.deadline
                  ? new Date(detail.cancellation.deadline).toISOString().replace("T", " ").slice(0, 16) +
                    " UTC"
                  : "the deadline shown at booking"}
                .
              </p>
              <CancelReservationButton
                bookingId={detail.id}
                reference={detail.bookingReference}
                mode={mode}
              />
            </>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">
              Online cancellation is no longer available for this reservation — please contact
              the hotel.
            </p>
          )}
        </section>

        {detail.notes && (
          <section className="space-y-1 text-sm">
            <h2 className="font-medium">Notes</h2>
            <pre className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{detail.notes}</pre>
          </section>
        )}

        <div className="flex gap-4 text-sm">
          <Link href="/" className="underline">
            Home
          </Link>
          {!session && (
            <Link href="/login" className="underline">
              Create an account to see this booking later
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
