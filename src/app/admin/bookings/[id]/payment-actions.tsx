"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { PaymentStatus } from "@/generated/prisma/enums";

/**
 * Staff money panel for one reservation: capture at the desk, refund a payment
 * (full remaining balance), and the list of recorded payments. Every action
 * hits the staff payments API; the service re-applies status rules and re-derives
 * the booking's paymentStatus server-side.
 */

type Payment = {
  id: string;
  provider: string;
  providerReference: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  refundedAmount: string;
  paidAt: string | null;
  refundedAt: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  already_paid: "This reservation is already paid.",
  booking_not_payable: "This reservation can no longer take payments.",
  not_refundable: "This payment can no longer be refunded.",
  refund_exceeds_paid: "That refund exceeds the remaining captured amount.",
  refund_refused: "The payment provider refused the refund.",
  not_found: "Payment not found.",
  internal: "Something went wrong.",
};

function messageFor(error: string): string {
  return ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal;
}

export function PaymentActions({
  bookingId,
  paymentStatus,
  bookingStatus,
  payments,
  currency,
}: {
  bookingId: string;
  paymentStatus: PaymentStatus;
  bookingStatus: string;
  payments: Payment[];
  currency: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const payable =
    (bookingStatus === "PENDING" || bookingStatus === "CONFIRMED") && paymentStatus !== "PAID";

  async function post(url: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messageFor(data.error ?? "internal"));
        setBusy(false);
        return;
      }
      setFlash(success);
      setBusy(false);
      window.location.reload();
    } catch {
      setError(ERROR_MESSAGES.internal);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {payments.length > 0 && (
        <ul className="divide-y divide-[var(--admin-line)]">
          {payments.map((payment) => {
            const refundable =
              payment.status === PaymentStatus.PAID ||
              payment.status === PaymentStatus.PARTIALLY_REFUNDED;
            return (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <StatusBadge status={payment.status} />
                    <span className="tabular-nums">
                      {payment.currency} {payment.amount}
                    </span>
                    {Number(payment.refundedAmount) > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        refunded {payment.refundedAmount}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payment.provider}
                    {payment.providerReference ? ` · ${payment.providerReference}` : ""}
                    {payment.paidAt
                      ? ` · paid ${payment.paidAt.slice(0, 16).replace("T", " ")}`
                      : ""}
                  </p>
                </div>
                {refundable && (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      post(`/api/staff/payments/${payment.id}/refund`, {}, "Refund recorded.")
                    }
                    variant="outline"
                    size="sm"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Refund remaining
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {payments.length === 0 && (
        <p className="text-sm text-muted-foreground">No payments recorded for this reservation.</p>
      )}

      {payable && (
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              post("/api/staff/payments", { bookingId, mode: "desk" }, "Desk payment recorded.")
            }
          >
            Record desk payment
          </Button>
        </div>
      )}

      {flash && <p className="text-sm text-emerald-700">{flash}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Amounts are shown in the currency they were sold in ({currency}).
      </p>
    </div>
  );
}
