"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";

export function PayButtons({ bookingId, reference }: { bookingId: string; reference: string }) {
  const router = useRouter();
  const t = useT();
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
          outcome === "succeeded" ? t("pay.error.declined") : t("pay.error.recorded"),
        );
        setBusy(false);
        if (outcome === "failed") router.refresh();
        return;
      }
      router.push(`/booking/confirmation?ref=${encodeURIComponent(reference)}`);
    } catch {
      setError(t("pay.error.internal"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="confirmation-actions">
        <Button type="button" onClick={() => complete("succeeded")} disabled={busy}>
          <CreditCard />
          {busy ? t("pay.processing") : t("pay.now")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => complete("failed")}
          disabled={busy}
        >
          {t("pay.simulateDecline")}
        </Button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
