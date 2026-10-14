import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaySummary } from "@/components/hotel/stay-summary";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/confirmation")({
  head: () =>
    meta(
      "Your stay at Santo Hotel",
      "Your Santo Hotel sample booking confirmation. This demonstration is not a real reservation.",
    ),
  component: Confirmation,
});
function Confirmation() {
  return (
    <div className="container page-content confirmation-page">
      <div className="confirmation-heading">
        <span className="success-icon">
          <Check />
        </span>
        <span className="eyebrow">SOMETHING TO LOOK FORWARD TO</span>
        <h1>Your Stay at Santo Hotel</h1>
        <p>A little escape, thoughtfully put together.</p>
        <span className="subtle-badge">Demo confirmation · No real booking exists</span>
      </div>
      <div className="checkout-layout">
        <section className="form-section">
          <span className="eyebrow">SAMPLE BOOKING REFERENCE</span>
          <h2>ST-DEMO-2026</h2>
          <div className="review-details">
            <span>
              Guest<strong>Alex Morgan · Placeholder guest</strong>
            </span>
            <span>
              Payment status<strong>Demo only · No payment taken</strong>
            </span>
            <span>
              Cancellation policy<strong>Hotel-approved terms to be confirmed</strong>
            </span>
          </div>
          <div className="info-notice">
            <Check />
            <p>
              This is a sample confirmation. No reservation was created and no confirmation email
              has been sent.
            </p>
          </div>
          <h3>A question before your stay?</h3>
          <p>Hotel contact details will be provided here.</p>
          <Link to="/contact" className="text-link">
            Contact information
            <ArrowRight size={15} />
          </Link>
          <div className="confirmation-actions">
            <Button asChild>
              <Link to="/account">
                View sample booking
                <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print confirmation
            </Button>
          </div>
          <Link to="/" className="text-link">
            Return to homepage
          </Link>
        </section>
        <StaySummary />
      </div>
    </div>
  );
}
