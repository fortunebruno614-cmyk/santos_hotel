"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Checkout form — the only interactive part of `/booking`. It posts the stay
 * (plus the total the guest was looking at) to `/api/public/checkout`; the
 * server re-checks availability and re-prices inside the booking transaction,
 * so a `price_changed`/`unavailable` answer simply swaps the message below.
 */

type QuoteLine = {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  nightlyRate: string;
  nights: number;
  roomTotal: string;
  perNight: string[];
};

type QuoteData = {
  currency: string;
  nights: number;
  lines: QuoteLine[];
  promotion: { code: string; discount: string } | null;
  breakdown: { subtotal: string; taxes: string; fees: string; discount: string; total: string };
  policy: { cancellationWindowHours: number };
};

type StayData = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomIds: string[];
};

const ERROR_MESSAGES: Record<string, string> = {
  price_changed:
    "The price changed while you were booking. The totals above are current — please review and confirm again.",
  unavailable: "Those rooms are no longer available for your dates. Please search again.",
  account_required: "An account is required to book online — please sign in first.",
  check_in_past: "That stay would start in the past — please choose new dates.",
  promotion_not_found: "That promotion code does not exist.",
  promotion_inactive: "That promotion is not currently active.",
  promotion_expired: "That promotion is no longer valid.",
  promotion_exhausted: "That promotion has been fully redeemed.",
  too_many_rooms: "That is more rooms than a single reservation may hold.",
  invalid_body: "Please check the form fields and try again.",
  internal: "Something went wrong creating the reservation. Please try again.",
};

function messageFor(error: string): string {
  return ERROR_MESSAGES[error] ?? "The reservation could not be completed.";
}

export function CheckoutForm({
  stay,
  quote,
  promotionCode,
  prefill,
}: {
  stay: StayData;
  quote: QuoteData;
  promotionCode: string | null;
  prefill: { firstName: string; lastName: string; email: string | null } | null;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: stay.adults,
          children: stay.children,
          roomIds: stay.roomIds,
          guest: { firstName, lastName, email, phone, idType, idNumber },
          promotionCode: promotionCode ?? undefined,
          notes: notes || undefined,
          expectedTotal: quote.breakdown.total,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messageFor(String(body.error ?? "internal")));
        return;
      }
      const reference = body.booking?.bookingReference as string;
      router.push(`/booking/confirmation?ref=${encodeURIComponent(reference)}`);
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-medium">Guest details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>First name *</span>
            <input
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={80}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Last name *</span>
            <input
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={80}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Email *</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={200}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={40}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>ID type</span>
            <input
              value={idType}
              onChange={(event) => setIdType(event.target.value)}
              placeholder="passport / national id"
              className="w-full border px-3 py-2 rounded-md"
              maxLength={40}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>ID number</span>
            <input
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={60}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Notes for the hotel</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full border px-3 py-2 rounded-md"
            rows={2}
            maxLength={500}
          />
        </label>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="font-medium">Cancellation policy</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Free cancellation up to {quote.policy.cancellationWindowHours} hours before check-in.
        </p>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="border px-5 py-2 rounded-md font-medium disabled:opacity-50"
      >
        {submitting ? "Booking…" : `Confirm booking — ${quote.currency} ${quote.breakdown.total}`}
      </button>
    </form>
  );
}
