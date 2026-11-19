import Link from "next/link";
import {
  EmptyRow,
  Field,
  PageHeader,
  Pagination,
  ResultCount,
  StatusBadge,
  TableShell,
  Toolbar,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { PaymentStatus } from "@/generated/prisma/enums";
import { searchPayments } from "@/server/console/payments";
import { getConsoleContext } from "@/server/console/context";
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

  const { hotel } = await getConsoleContext();
  const result = await searchPayments(hotel.id, query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));
  const statuses = Object.values(PaymentStatus);

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.reference) params.set("reference", query.reference);
    if (query.status) params.set("status", query.status);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/admin/payments?${search}` : "/admin/payments";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="Captured, refunded and failed payments for the active property, correlated with their reservation."
      />

      <Toolbar>
        <form method="get" action="/admin/payments" className="flex flex-wrap items-end gap-3">
          <Field label="Booking reference" className="w-48">
            <input
              name="reference"
              defaultValue={query.reference ?? ""}
              placeholder="SH-2026-…"
            />
          </Field>
          <Field label="Status" className="w-44">
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">Any</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/payments">Reset</Link>
          </Button>
        </form>
      </Toolbar>

      <ResultCount>
        {result.total} payment{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </ResultCount>

      <TableShell>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Guest</th>
            <th>Provider</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Refunded</th>
            <th>Status</th>
            <th>Paid</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && (
            <EmptyRow colSpan={8}>No payments match this filter.</EmptyRow>
          )}
          {result.rows.map((row) => {
            const remaining = (Number(row.amount) - Number(row.refundedAmount)).toFixed(2);
            return (
              <tr key={row.id}>
                <td>
                  <Link
                    href={`/admin/bookings/${row.bookingId}`}
                    className="admin-mono font-medium text-primary hover:underline"
                  >
                    {row.bookingReference}
                  </Link>
                </td>
                <td>{row.guestName}</td>
                <td>
                  <span className="block">{row.provider}</span>
                  {row.providerReference && (
                    <span className="admin-mono block text-muted-foreground">
                      {row.providerReference}
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {row.amount} {row.currency}
                </td>
                <td className="text-right tabular-nums">{row.refundedAmount}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="whitespace-nowrap">{row.paidAt?.slice(0, 10) ?? "—"}</td>
                <td className="text-right">
                  {row.status === "PAID" || row.status === "PARTIALLY_REFUNDED" ? (
                    <RefundButton paymentId={row.id} remaining={remaining} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pagination page={result.page} pages={pages} hrefFor={hrefFor} />
    </div>
  );
}
