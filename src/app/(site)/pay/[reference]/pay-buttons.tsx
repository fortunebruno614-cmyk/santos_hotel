"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";

type InitiateResponse = {
  checkoutPath?: unknown;
  error?: unknown;
};

export function PayButtons({
  bookingId,
  reference,
  provider,
}: {
  bookingId: string;
  reference: string;
  provider: string;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMock = provider === "mock";

  const confirmationPath = `/booking/confirmation?ref=${encodeURIComponent(reference)}`;

  async function completeMock(outcome: "succeeded" | "failed") {
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
      router.push(confirmationPath);
    } catch {
      setError(t("pay.error.internal"));
      setBusy(false);
    }
  }

  async function startHostedCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/public/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = (await response.json().catch(() => null)) as InitiateResponse | null;

      if (!response.ok) {
        if (response.status === 409 && data?.error === "already_paid") {
          router.push(confirmationPath);
          return;
        }
        setError(t("pay.error.declined"));
        setBusy(false);
        return;
      }

      const checkoutPath = typeof data?.checkoutPath === "string" ? data.checkoutPath : "";
      if (!checkoutPath) {
        setError(t("pay.error.internal"));
        setBusy(false);
        return;
      }

      // Real gateways (Paystack) return an absolute hosted-checkout URL.
      if (/^https?:\/\//i.test(checkoutPath)) {
        window.location.assign(checkoutPath);
        return;
      }
      router.push(checkoutPath);
    } catch {
      setError(t("pay.error.internal"));
      setBusy(false);
    }
  }

  if (!isMock) {
    return (
      <div className="space-y-3">
        <div className="confirmation-actions">
          <Button type="button" onClick={startHostedCheckout} disabled={busy}>
            <CreditCard />
            {busy ? t("pay.processing") : t("pay.now")}
          </Button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <p className="text-muted-foreground text-sm">{t("pay.note")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="confirmation-actions">
        <Button type="button" onClick={() => completeMock("succeeded")} disabled={busy}>
          <CreditCard />
          {busy ? t("pay.processing") : t("pay.now")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => completeMock("failed")}
          disabled={busy}
        >
          {t("pay.simulateDecline")}
        </Button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
