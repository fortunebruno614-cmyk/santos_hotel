"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  too_late_to_cancel: "The free cancellation window has already passed.",
  not_cancellable: "This reservation can no longer be cancelled.",
  guest_cancellation_disabled: "Online cancellation is disabled — please contact the hotel.",
  not_found: "This reservation could not be found.",
  internal: "Something went wrong. Please try again.",
};

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
      <Button
        type="button"
        variant="outline"
        onClick={cancel}
        disabled={busy}
        className="text-destructive"
      >
        {busy ? "Cancelling…" : "Cancel reservation"}
      </Button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
