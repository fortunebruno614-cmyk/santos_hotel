"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";
import type { Translator } from "@/lib/dictionaries";

/** Server error codes → dictionary keys, translated at render. */
const ERROR_KEYS: Record<string, keyof import("@/lib/dictionaries").Dictionary> = {
  too_late_to_cancel: "cancel.error.too_late_to_cancel",
  not_cancellable: "cancel.error.not_cancellable",
  guest_cancellation_disabled: "cancel.error.guest_cancellation_disabled",
  not_found: "cancel.error.not_found",
  internal: "cancel.error.internal",
};

function messageFor(t: Translator, code: string): string {
  return t(ERROR_KEYS[code] ?? "cancel.error.internal");
}

export function CancelReservationButton({
  bookingId,
  reference,
  mode,
}: {
  bookingId: string;
  reference: string;
  mode: "account" | "claim";
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    if (!window.confirm(t("cancel.confirm"))) return;
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
        setError(messageFor(t, String(body.error ?? "internal")));
        return;
      }
      window.location.reload();
    } catch {
      setError(t("cancel.error.internal"));
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
        {busy ? t("cancel.busy") : t("cancel.action")}
      </Button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
