import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { PayButtons } from "./pay-buttons";
import { getCurrentSession } from "@/server/auth/dal";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import {
  BookingError,
  getBookingDetailByReference,
  type BookingViewer,
} from "@/server/booking/service";
import { formatMoney } from "@/server/pricing/context";

/**
 * Guest payment page (`/pay/SH-2026-000042`) — the mock gateway's hosted page.
 *
 * Access mirrors the confirmation page: the signed `booking_claim` cookie for
 * this reference, or a signed-in guest who owns the reservation. Anything else
 * is simply "not found".
 *
 * While the gateway is unconfirmed (docs/OPEN_QUESTIONS.md #4) the page offers
 * explicit succeed/fail buttons that drive the real signed-webhook path
 * (/api/public/payments/mock/complete). When a real hosted page replaces the
 * mock, this route becomes a redirect.
 */
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Complete payment</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Reservation <span className="font-mono">{detail.bookingReference}</span> ·{" "}
            {detail.checkIn} → {detail.checkOut}
          </p>
        </div>

        <section className="space-y-2 rounded-xl border border-black/10 p-5 text-sm dark:border-white/15">
          <h2 className="font-medium">Amount due</h2>
          <p className="text-3xl font-semibold">{formatMoney(detail.breakdown.total, detail.currency)}</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {detail.nights} {detail.nights === 1 ? "night" : "nights"} · {detail.adults} adult
            {detail.adults === 1 ? "" : "s"}
            {detail.children > 0 ? `, ${detail.children} children` : ""}
          </p>
        </section>

        {payable ? (
          <section className="space-y-3 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              This is a simulated payment page while the hotel&apos;s gateway is being confirmed.
              Choose an outcome to exercise the full signed-webhook flow.
            </p>
            <PayButtons bookingId={detail.id} reference={detail.bookingReference} />
          </section>
        ) : (
          <section className="space-y-2 text-sm">
            <p className="font-medium">
              {paid ? "This reservation is already paid." : "This reservation is cancelled."}
            </p>
            <Link href={`/booking/confirmation?ref=${encodeURIComponent(reference)}`} className="underline">
              Back to the confirmation page
            </Link>
          </section>
        )}

        <div className="flex gap-4 text-sm">
          <Link href="/" className="underline">
            Home
          </Link>
        </div>
      </main>
    </>
  );
}
