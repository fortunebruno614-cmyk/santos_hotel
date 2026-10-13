import Link from "next/link";
import { PaymentStatus } from "@/generated/prisma/enums";
import { searchPayments } from "@/server/console/payments";
import { PaymentSearchSchema } from "@/server/console/validation";
import { RefundButton } from "./refund-button";

/**
 * Payment records (P7): the ledger with booking correlation, status and
 * reference filters, and a permission-gated refund action per captured row.
 * Desk capture and online initiation live on the reservation detail page.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = PaymentSearchSchema.safeParse({
    status: sp.status ?? undefined,
    reference: sp.reference ?? undefined,
    page: sp.page ?? undefined,
    pageSize: sp.pageSize ?? undefined,
  });
  const query = parsed.success ? parsed.data : PaymentSearchSchema.parse({});

  const result = await searchPayments(query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));
  const statuses = Object.values(PaymentStatus);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Payments</h1>

      <form method="get" action="/admin/payments" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Booking reference</span>
          <input
            name="reference"
            defaultValue={query.reference ?? ""}
            placeholder="SH-2026-…"
            className="border px-2 py-1 rounded-md w-48"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="border px-2 py-1 rounded-md"
          >
            <option value="">Any</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button className="border px-3 py-1 rounded-md">Filter</button>
        <Link href="/admin/payments" className="text-zinc-500 underline">
          Reset
        </Link>
      </form>

      <p className="text-sm text-zinc-500">
        {result.total} payment{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Booking</th>
              <th className="py-2 pr-4">Guest</th>
              <th className="py-2 pr-4">Provider</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Refunded</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Paid</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-zinc-500">
                  No payments match this filter.
                </td>
              </tr>
            )}
            {result.rows.map((row) => {
              const remaining = (Number(row.amount) - Number(row.refundedAmount)).toFixed(2);
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/bookings/${row.bookingId}`} className="font-mono underline">
                      {row.bookingReference}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{row.guestName}</td>
                  <td className="py-2 pr-4">
                    {row.provider}
                    {row.providerReference && (
                      <span className="block text-xs text-zinc-500 font-mono">
                        {row.providerReference}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {row.amount} {row.currency}
                  </td>
                  <td className="py-2 pr-4">{row.refundedAmount}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 pr-4">{row.paidAt?.slice(0, 10) ?? "—"}</td>
                  <td className="py-2">
                    {row.status === "PAID" || row.status === "PARTIALLY_REFUNDED" ? (
                      <RefundButton paymentId={row.id} remaining={remaining} />
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
