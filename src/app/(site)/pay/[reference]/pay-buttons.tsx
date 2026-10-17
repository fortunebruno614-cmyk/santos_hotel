"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayButtons({ bookingId, reference }: { bookingId: string; reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete(outcome: "succeeded" | "failed") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/public/payments/mock/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, outcome }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          outcome === "succeeded"
            ? "The payment could not be completed. Please try again."
            : "The simulated decline was recorded.",
        );
        setBusy(false);
        if (outcome === "failed") router.refresh();
        return;
      }
      router.push(`/booking/confirmation?ref=${encodeURIComponent(reference)}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="confirmation-actions">
        <Button type="button" onClick={() => complete("succeeded")} disabled={busy}>
          <CreditCard />
          {busy ? "Processing…" : "Pay now"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => complete("failed")}
          disabled={busy}
        >
          Simulate declined card
        </Button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
