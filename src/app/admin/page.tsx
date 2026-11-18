import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  ANALYTICS_RANGES,
  getExecutiveAnalytics,
  parseAnalyticsRange,
} from "@/server/console/analytics";
import { getConsoleContext } from "@/server/console/context";
import { getDashboard } from "@/server/console/dashboard";
import { Permissions, hasOrgPermission } from "@/server/auth/roles";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import {
  ExpenseBreakdownWidget,
  FinancialPositionWidget,
  KpiWidget,
  OperationsWidget,
} from "@/components/dashboard/widgets";
import { WidgetCard, formatDateTime, formatMoney } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

/**
 * Executive dashboard. Every figure is resolved server-side for the active
 * tenant hotel; the URL only chooses the reporting range and layout density.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { hotel, member } = await getConsoleContext();
  const range = parseAnalyticsRange(sp.range);
  const compact = sp.density === "compact";
  const canReport = hasOrgPermission(member.role, Permissions.VIEW_REPORTS);

  const [analytics, operations] = await Promise.all([
    getExecutiveAnalytics(hotel.id, range),
    getDashboard(hotel.id),
  ]);

  const rangeLabel = ANALYTICS_RANGES.find((entry) => entry.value === range)?.label ?? "Last 30 days";
  const currentHref = (nextRange: string, density = compact ? "compact" : "comfortable") =>
    `/admin?range=${nextRange}&density=${density}`;

  return (
    <div className="-m-6 min-h-full bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">Dashboard</h1>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Live
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {hotel.name} · {rangeLabel} · {analytics.currency}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin?range=${range}&density=${compact ? "comfortable" : "compact"}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
            >
              <SlidersHorizontal size={13} />
              {compact ? "Comfortable layout" : "Compact layout"}
            </Link>
            {canReport && (
              <a
                href={`/api/admin/reports/transactions?range=${range}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-800"
              >
                <Download size={13} />
                Generate report
              </a>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
          <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 shadow-sm">
            {ANALYTICS_RANGES.map((entry) => (
              <Link
                key={entry.value}
                href={currentHref(entry.value)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  range === entry.value
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-medium text-zinc-600 shadow-sm">
                <CalendarDays size={12} />
                Compare: previous period
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-2 text-[11px] shadow-lg">
                <p className="rounded bg-zinc-50 px-2 py-1.5 font-medium text-zinc-800">
                  Previous period
                </p>
                <p className="px-2 py-1.5 text-zinc-500">No other comparison periods configured.</p>
              </div>
            </details>
            <span className="inline-flex items-center gap-1">
              <RefreshCcw size={11} />
              Updated {formatDateTime(analytics.generatedAt, hotel.timezone)}
            </span>
            <Link
              href={`/admin?range=${range}&density=${compact ? "comfortable" : "compact"}`}
              className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900"
            >
              <SlidersHorizontal size={11} />
              Manage layout
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiWidget label="Total revenue" kpi={analytics.kpis.revenue} currency={analytics.currency} />
          <KpiWidget
            label="Total expenses"
            kpi={analytics.kpis.expenses}
            currency={analytics.currency}
            invert
          />
          <KpiWidget label="Net profit" kpi={analytics.kpis.netProfit} currency={analytics.currency} />
          <KpiWidget
            label="Active customers"
            kpi={analytics.kpis.activeCustomers}
            currency={analytics.currency}
            format="number"
          />
          <KpiWidget
            label="Transactions"
            kpi={analytics.kpis.transactions}
            currency={analytics.currency}
            format="number"
          />
          <KpiWidget
            label="Revenue growth"
            kpi={analytics.kpis.growth}
            currency={analytics.currency}
            format="percent"
            sparkColor="#047857"
          />
        </div>

        <div
          className={`mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.85fr)] ${
            compact ? "gap-3" : ""
          }`}
        >
          <div className="min-w-0 space-y-4">
            <div id="insights">
              <WidgetCard
                title="Revenue & expenses"
                subtitle={`${rangeLabel} · compared with the previous period`}
                action={
                  <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    {analytics.currency}
                  </span>
                }
              >
                <RevenueChart data={analytics.series} currency={analytics.currency} />
              </WidgetCard>
            </div>

            <WidgetCard
              title="Recent transactions"
              subtitle="Payments captured for this property"
              action={
                <Link
                  href="/admin/payments"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
                >
                  View all <ArrowUpRight size={12} />
                </Link>
              }
              bodyClassName="p-0"
            >
              <TransactionsTable rows={analytics.transactions} timezone={hotel.timezone} />
            </WidgetCard>
          </div>

          <div className="min-w-0 space-y-4">
            <WidgetCard title="Operations overview" subtitle="Live property performance">
              <OperationsWidget operations={analytics.operations} housekeeping={operations.housekeeping} />
            </WidgetCard>

            <WidgetCard title="Financial position" subtitle="Balances and target progress">
              <FinancialPositionWidget financial={analytics.financial} currency={analytics.currency} />
            </WidgetCard>

            <WidgetCard title="Expense breakdown" subtitle="Where the money went">
              <ExpenseBreakdownWidget
                expenses={analytics.expenses}
                total={analytics.expenseTotal}
                currency={analytics.currency}
              />
            </WidgetCard>

            <WidgetCard title="Today at the property" subtitle={operations.today}>
              <div className="grid grid-cols-2 gap-3">
                <TodayColumn
                  title="Arrivals"
                  rows={operations.arrivals.slice(0, 4).map((row) => ({
                    id: row.id,
                    primary: row.guestName,
                    secondary: row.roomNumbers.join(", ") || "Unassigned",
                  }))}
                  empty="No arrivals today"
                />
                <TodayColumn
                  title="Departures"
                  rows={operations.departures.slice(0, 4).map((row) => ({
                    id: row.id,
                    primary: row.guestName,
                    secondary: row.roomNumbers.join(", ") || "Unassigned",
                  }))}
                  empty="No departures today"
                />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-[10px] text-zinc-500">
                <span>{operations.inHouse.length} in house</span>
                <span>{operations.occupancy.percent}% occupancy tonight</span>
                <Link href="/admin/bookings" className="font-medium text-zinc-600 hover:text-zinc-900">
                  Open desk
                </Link>
              </div>
            </WidgetCard>
          </div>
        </div>

        <div className="mt-4">
          <WidgetCard
            title="Availability board"
            subtitle={`Next ${operations.board.nights.length} nights · filled cells are sold`}
            action={
              <Link
                href="/admin/rooms"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
              >
                Manage rooms <ArrowUpRight size={12} />
              </Link>
            }
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400">
                    <th className="px-4 py-2 font-medium">Room</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    {operations.board.nights.map((night) => (
                      <th key={night} className="px-1 py-2 text-center font-medium whitespace-nowrap">
                        {night.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operations.board.rooms.map((room) => (
                    <tr key={room.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-1.5 font-medium text-zinc-700">{room.roomNumber}</td>
                      <td className="px-2 py-1.5 text-zinc-500">{room.roomTypeName}</td>
                      {room.cells.map((cell) => (
                        <td key={cell.night} className="px-1 py-1.5 text-center">
                          <span
                            className={`inline-block h-2.5 w-full max-w-8 rounded-[2px] ${
                              cell.kind === "sold"
                                ? "bg-zinc-900"
                                : cell.kind === "blocked"
                                  ? "bg-red-200"
                                  : "bg-zinc-100"
                            }`}
                            title={
                              cell.kind === "sold"
                                ? cell.bookingReference ?? "Sold"
                                : cell.kind === "blocked"
                                  ? "Blocked"
                                  : "Free"
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
          <span>
            All amounts in {analytics.currency}. Data from {analytics.from} to {analytics.to}.
          </span>
          <span>
            {formatMoney(analytics.financial.currentBalance, analytics.currency)} current balance
          </span>
        </div>
      </div>
    </div>
  );
}

function TodayColumn({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string }>;
  empty: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-zinc-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/bookings/${row.id}`} className="block truncate">
                <span className="block truncate text-[11px] font-medium text-zinc-700">
                  {row.primary}
                </span>
                <span className="block truncate text-[10px] text-zinc-400">{row.secondary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
