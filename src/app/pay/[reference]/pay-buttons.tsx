"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Mock-gateway pay buttons. Each POST drives the signed-webhook path
 * (/api/public/payments/mock/complete → handleWebhook) so success, failure and
 * replay are exercised end-to-end. On success the guest lands on the
 * confirmation page; on failure the booking correctly stays PENDING/unpaid.
 */
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
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => complete("succeeded")}
          disabled={busy}
          className="rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busy ? "Processing…" : "Pay now"}
        </button>
        <button
          type="button"
          onClick={() => complete("failed")}
          disabled={busy}
          className="rounded-lg border border-black/20 px-5 py-2.5 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Simulate declined card
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
