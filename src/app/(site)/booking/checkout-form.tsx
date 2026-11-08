"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";
import type { Translator } from "@/lib/dictionaries";

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
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomIds: string[];
};

/** Server error codes → dictionary keys, so the copy translates at render. */
const ERROR_KEYS: Record<string, keyof import("@/lib/dictionaries").Dictionary> = {
  price_changed: "checkout.error.price_changed",
  unavailable: "checkout.error.unavailable",
  account_required: "checkout.error.account_required",
  check_in_past: "checkout.error.check_in_past",
  promotion_not_found: "checkout.error.promotion_not_found",
  promotion_inactive: "checkout.error.promotion_inactive",
  promotion_expired: "checkout.error.promotion_expired",
  promotion_exhausted: "checkout.error.promotion_exhausted",
  too_many_rooms: "checkout.error.too_many_rooms",
  invalid_body: "checkout.error.invalid_body",
  internal: "checkout.error.internal",
};

function messageFor(t: Translator, error: string): string {
  return t(ERROR_KEYS[error] ?? "checkout.error.fallback");
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
  const t = useT();
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
          hotelId: stay.hotelId,
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
        setError(messageFor(t, String(body.error ?? "internal")));
        return;
      }
      const reference = body.booking?.bookingReference as string;
      router.push(`/booking/confirmation?ref=${encodeURIComponent(reference)}`);
    } catch {
      setError(t("checkout.error.internal"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout-form">
      <ol className="checkout-steps">
        {[t("checkout.step.guest"), t("checkout.step.review"), t("checkout.step.confirm")].map(
          (label, index) => (
            <li key={label} className={index <= step ? "current" : ""}>
              <span>{index < step ? <Check size={15} /> : index + 1}</span>
              {label}
            </li>
          ),
        )}
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
          <h2>{t("checkout.guestTitle")}</h2>
          <p className="tiny-note">{t("checkout.privacyNote")}</p>
          <div className="form-grid">
            <label>
              {t("checkout.firstName")}
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label>
              {t("checkout.lastName")}
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label>
              {t("checkout.email")}
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
              {t("checkout.phone")}
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <label>
              {t("checkout.idType")}
              <input
                value={idType}
                onChange={(event) => setIdType(event.target.value)}
                placeholder={t("checkout.idTypePlaceholder")}
                maxLength={40}
              />
            </label>
            <label>
              {t("checkout.idNumber")}
              <input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                maxLength={60}
              />
            </label>
            <label className="full">
              {t("checkout.requests")}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder={t("checkout.requestsPlaceholder")}
              />
              <small>{t("checkout.requestsNote")}</small>
            </label>
          </div>
          <div className="info-notice">
            <ShieldCheck />
            <div>
              <strong>{t("checkout.secureTitle")}</strong>
              <p>
                {t("checkout.secureBody", {
                  hours: quote.policy.cancellationWindowHours,
                })}
              </p>
            </div>
          </div>
          <Button type="submit">
            {t("checkout.reviewStay")}
            <ArrowRight />
          </Button>
        </form>
      ) : (
        <div className="form-section">
          <h2>{t("checkout.reviewTitle")}</h2>
          <div className="review-details">
            <span>
              {t("checkout.guestName")}
              <strong>
                {firstName} {lastName}
              </strong>
            </span>
            <span>
              {t("checkout.email")}
              <strong>{email}</strong>
            </span>
            {phone && (
              <span>
                {t("checkout.phone")}
                <strong>{phone}</strong>
              </span>
            )}
            {idType && idNumber && (
              <span>
                {t("checkout.identification")}
                <strong>
                  {idType} · {idNumber}
                </strong>
              </span>
            )}
            <span>
              {t("checkout.stayRow")}
              <strong>
                {quote.nights} {quote.nights === 1 ? t("room.night") : t("room.nights")} ·{" "}
                {quote.lines.length}{" "}
                {quote.lines.length === 1 ? t("summary.room") : t("summary.rooms")}
              </strong>
            </span>
            {notes && (
              <span>
                {t("checkout.requests")}
                <strong>{notes}</strong>
              </span>
            )}
          </div>
          <Button variant="link" onClick={() => setStep(0)}>
            {t("checkout.editGuest")}
          </Button>

          <div className="payment-placeholder">
            <CreditCard />
            <h3>{t("checkout.paymentTitle")}</h3>
            <p>{t("checkout.paymentBody")}</p>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            {t("checkout.acceptTerms")}
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft />
              {t("checkout.back")}
            </Button>
            <Button onClick={submit} disabled={!accepted || submitting}>
              {submitting ? t("checkout.reserving") : t("checkout.complete")}
              <ArrowRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
