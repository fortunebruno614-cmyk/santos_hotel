"use client";

import { useState } from "react";

/**
 * Refund action (P7, permission-gated server-side with MANAGE_PAYMENTS).
 *
 *   POST /api/staff/payments/{id}/refund  { amount? }
 *
 * Blank amount = the full remaining balance; anything else is a partial refund
 * validated by the payments service (never more than the captured remainder).
 */

export function RefundButton({
  paymentId,
  remaining,
}: {
  paymentId: string;
  remaining: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refund = async () => {
    const remainingNumber = Number(remaining);
    if (!Number.isFinite(remainingNumber) || remainingNumber <= 0) return;
    const raw = window.prompt(
      `Refund amount (blank = full remaining ${remaining}).`,
      "",
    );
    if (raw === null) return;
    const amount = raw.trim() === "" ? undefined : raw.trim();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(amount === undefined ? {} : { amount }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setError(body.message ?? body.error ?? "Refund failed.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Refund failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={refund}
        disabled={busy || Number(remaining) <= 0}
        className="border px-2 py-1 rounded-md text-xs text-red-600 disabled:opacity-50"
      >
        {busy ? "Refunding…" : "Refund"}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
