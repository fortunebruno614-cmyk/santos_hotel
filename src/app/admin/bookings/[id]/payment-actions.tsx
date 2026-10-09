"use client";

import { useState } from "react";
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
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {payments.map((payment) => {
            const refundable =
              payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIALLY_REFUNDED;
            return (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {payment.status} · {currency} {payment.amount}
                    {Number(payment.refundedAmount) > 0 && ` (refunded ${payment.refundedAmount})`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {payment.provider}
                    {payment.providerReference ? ` · ${payment.providerReference}` : ""}
                    {payment.paidAt ? ` · paid ${payment.paidAt.slice(0, 16).replace("T", " ")}` : ""}
                  </p>
                </div>
                {refundable && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      post(`/api/staff/payments/${payment.id}/refund`, {}, "Refund recorded.")
                    }
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Refund remaining
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {payable && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              post("/api/staff/payments", { bookingId, mode: "desk" }, "Desk payment recorded.")
            }
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Record desk payment
          </button>
        </div>
      )}

      {flash && <p className="text-sm text-green-700 dark:text-green-400">{flash}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
