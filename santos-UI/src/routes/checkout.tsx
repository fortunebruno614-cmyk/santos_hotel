import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ChevronLeft, CreditCard, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaySummary } from "@/components/hotel/stay-summary";
import { PageHeading } from "@/components/hotel/shared";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/checkout")({
  head: () =>
    meta(
      "Complete your stay",
      "Review your selection and walk through the Santo Hotel demonstration checkout. No payments or reservations are made.",
    ),
  component: Checkout,
});
function Checkout() {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    country: "",
    requests: "",
  });
  const navigate = useNavigate();
  return (
    <div className="container page-content checkout-page">
      <Link to="/rooms" className="text-link">
        <ChevronLeft size={16} />
        Back to rooms
      </Link>
      <ol className="checkout-steps">
        {["Your selection", "Guest details", "Review booking", "Confirmation"].map((s, i) => (
          <li key={s} className={i <= step ? "current" : ""}>
            <span>{i < step ? <Check size={15} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <PageHeading
        eyebrow="A FEW THOUGHTFUL DETAILS"
        title={
          step === 0
            ? "Your stay, coming together."
            : step === 1
              ? "Let’s make it personal."
              : "Everything, at a glance."
        }
        description="A demonstration booking journey. No reservation or payment will be made."
      />
      <div className="checkout-layout">
        <section>
          {step === 0 ? (
            <>
              <div className="form-section">
                <h2>A little room to unwind.</h2>
                <p>
                  Your selected accommodation is ready to review. Check your dates and room choice
                  before continuing.
                </p>
                <div className="info-notice">
                  <ShieldCheck />
                  <div>
                    <strong>A clear picture of your stay</strong>
                    <p>
                      All amounts are sample rates. Hotel-approved cancellation, check-in and
                      payment terms will appear here.
                    </p>
                  </div>
                </div>
                <h3>Included in this sample stay</h3>
                <ul className="check-list">
                  <li>
                    <Check />
                    Thoughtfully appointed accommodation
                  </li>
                  <li>
                    <Check />
                    Sample in-room comforts
                  </li>
                  <li>
                    <Check />A warm Santo welcome
                  </li>
                </ul>
                <Button onClick={() => setStep(1)}>
                  Continue to guest details
                  <ArrowRight />
                </Button>
              </div>
            </>
          ) : step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
                window.scrollTo(0, 0);
              }}
              className="form-section"
            >
              <h2>Guest details</h2>
              <p className="tiny-note">
                Use sample information only. These details are not saved or transmitted.
              </p>
              <div className="form-grid">
                {(
                  [
                    ["first", "First name", "text"],
                    ["last", "Last name", "text"],
                    ["email", "Email address", "email"],
                    ["phone", "Phone number (optional)", "tel"],
                  ] as const
                ).map(([key, label, type]) => (
                  <label key={key}>
                    {label}
                    {key !== "phone" && " *"}
                    <input
                      required={key !== "phone"}
                      type={type}
                      autoComplete="off"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  Country / region *
                  <select
                    required
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  >
                    <option value="">Select country / region</option>
                    {[
                      "United Kingdom",
                      "United States",
                      "France",
                      "Germany",
                      "Nigeria",
                      "Other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Special requests (optional)
                  <textarea
                    rows={4}
                    value={form.requests}
                    onChange={(e) => setForm({ ...form, requests: e.target.value })}
                    placeholder="A little detail that would make your stay more comfortable"
                  />
                  <small>Requests are illustrative and cannot be sent to the hotel.</small>
                </label>
              </div>
              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  <ChevronLeft />
                  Back
                </Button>
                <Button type="submit">
                  Review your stay
                  <ArrowRight />
                </Button>
              </div>
            </form>
          ) : (
            <div className="form-section">
              <h2>Review your details</h2>
              <div className="review-details">
                <span>
                  Guest name
                  <strong>
                    {form.first} {form.last}
                  </strong>
                </span>
                <span>
                  Email address<strong>{form.email}</strong>
                </span>
                <span>
                  Country / region<strong>{form.country}</strong>
                </span>
                {form.requests && (
                  <span>
                    Special requests<strong>{form.requests}</strong>
                  </span>
                )}
              </div>
              <Button variant="link" onClick={() => setStep(1)}>
                Edit guest details
              </Button>
              <div className="payment-placeholder">
                <CreditCard />
                <h3>Payment at a later step</h3>
                <p>
                  Payment options will be confirmed by the hotel. This demo does not collect card
                  details or process payments.
                </p>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I understand this is a simulated booking and the hotel’s final terms are not yet
                available.
              </label>
              <div className="form-actions">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft />
                  Back
                </Button>
                <Button disabled={!accepted} onClick={() => navigate({ to: "/confirmation" })}>
                  Complete demo booking
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </section>
        <StaySummary />
      </div>
    </div>
  );
}
