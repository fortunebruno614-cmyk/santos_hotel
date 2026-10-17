"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!accepted) return;
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
    <div className="checkout-form">
      <ol className="checkout-steps">
        {["Guest details", "Review booking", "Confirmation"].map((label, index) => (
          <li key={label} className={index <= step ? "current" : ""}>
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <form
          className="form-section"
          onSubmit={(event) => {
            event.preventDefault();
            setStep(1);
            window.scrollTo(0, 0);
          }}
        >
          <h2>Guest details</h2>
          <p className="tiny-note">
            Your details are used only to manage this reservation.
          </p>
          <div className="form-grid">
            <label>
              First name *
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name *
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label>
              Email address *
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={200}
                autoComplete="email"
              />
            </label>
            <label>
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <label>
              ID type
              <input
                value={idType}
                onChange={(event) => setIdType(event.target.value)}
                placeholder="Passport / national ID"
                maxLength={40}
              />
            </label>
            <label>
              ID number
              <input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                maxLength={60}
              />
            </label>
            <label className="full">
              Special requests (optional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="A little detail that would make your stay more comfortable"
              />
              <small>Requests are shared with the hotel team.</small>
            </label>
          </div>
          <div className="info-notice">
            <ShieldCheck />
            <div>
              <strong>Secure reservation</strong>
              <p>
                Free cancellation up to {quote.policy.cancellationWindowHours} hours before
                check-in. Payment is completed after your reservation is reviewed.
              </p>
            </div>
          </div>
          <Button type="submit">
            Review your stay
            <ArrowRight />
          </Button>
        </form>
      ) : (
        <div className="form-section">
          <h2>Review your details</h2>
          <div className="review-details">
            <span>
              Guest name
              <strong>
                {firstName} {lastName}
              </strong>
            </span>
            <span>
              Email address<strong>{email}</strong>
            </span>
            {phone && (
              <span>
                Phone number<strong>{phone}</strong>
              </span>
            )}
            {idType && idNumber && (
              <span>
                Identification<strong>{idType} · {idNumber}</strong>
              </span>
            )}
            <span>
              Stay<strong>{quote.nights} {quote.nights === 1 ? "night" : "nights"} · {quote.lines.length} room{quote.lines.length === 1 ? "" : "s"}</strong>
            </span>
            {notes && (
              <span>
                Special requests<strong>{notes}</strong>
              </span>
            )}
          </div>
          <Button variant="link" onClick={() => setStep(0)}>
            Edit guest details
          </Button>

          <div className="payment-placeholder">
            <CreditCard />
            <h3>Payment after confirmation</h3>
            <p>
              Your reservation is created first. You can then complete payment securely from the
              confirmation page.
            </p>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            I confirm these details are correct and I accept the hotel&apos;s cancellation terms.
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft />
              Back
            </Button>
            <Button onClick={submit} disabled={!accepted || submitting}>
              {submitting ? "Reserving…" : "Complete reservation"}
              <ArrowRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
