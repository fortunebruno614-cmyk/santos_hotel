"use client";

import { useState } from "react";

const MESSAGES: Record<string, string> = {
  too_late_to_cancel: "The free cancellation window has already passed.",
  not_cancellable: "This reservation can no longer be cancelled.",
  guest_cancellation_disabled: "Online cancellation is disabled — please contact the hotel.",
  not_found: "This reservation could not be found.",
  internal: "Something went wrong. Please try again.",
};

/**
 * Guest-facing cancel button. Signed-in guests post to their account endpoint;
 * anonymous bookings use the checkout claim cookie on the public endpoint.
 * The server re-applies the cancellation window either way.
 */
export function CancelReservationButton({
  bookingId,
  reference,
  mode,
}: {
  bookingId: string;
  reference: string;
  mode: "account" | "claim";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    if (!window.confirm("Cancel this reservation?")) return;
    setBusy(true);
    setError(null);
    try {
      const url =
        mode === "account"
          ? `/api/account/bookings/${bookingId}/cancel`
          : `/api/public/bookings/${encodeURIComponent(reference)}/cancel`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(MESSAGES[String(body.error ?? "internal")] ?? MESSAGES.internal);
        return;
      }
      window.location.reload();
    } catch {
      setError(MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="border border-red-300 px-4 py-2 rounded-md text-sm text-red-700 disabled:opacity-50"
      >
        {busy ? "Cancelling…" : "Cancel reservation"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
