import { Delta, ProgressBar, Sparkline, formatCompactMoney, formatMoney, formatNumber } from "./ui";
import type { ExecutiveAnalytics, KpiValue } from "@/server/console/analytics";

export function KpiWidget({
  label,
  kpi,
  currency,
  format = "money",
  invert = false,
  sparkColor,
}: {
  label: string;
  kpi: KpiValue;
  currency: string;
  format?: "money" | "number" | "percent";
  invert?: boolean;
  sparkColor?: string;
}) {
  const display =
    format === "percent"
      ? `${kpi.value.toFixed(1)}%`
      : format === "number"
        ? formatNumber(kpi.value)
        : formatCompactMoney(kpi.value, currency);
  const delta = invert ? -kpi.changePct : kpi.changePct;
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="truncate text-[21px] font-semibold leading-none tracking-tight text-zinc-900">
          {display}
        </p>
        <Sparkline
          values={kpi.spark.length > 1 ? kpi.spark : [0, 0, 0]}
          color={sparkColor ?? (delta >= 0 ? "#047857" : "#dc2626")}
          fill={delta >= 0 ? "rgba(4,120,87,0.08)" : "rgba(220,38,38,0.07)"}
          width={64}
          height={22}
        />
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <Delta value={delta} />
        <span className="truncate text-[10px] text-zinc-400">vs previous period</span>
      </div>
    </div>
  );
}

export function OperationsWidget({
  operations,
  housekeeping,
}: {
  operations: ExecutiveAnalytics["operations"];
  housekeeping: { cleaning: number; maintenance: number; outOfService: number; available: number };
}) {
  return (
    <div className="space-y-3.5">
      <MetricRow
        label="Room occupancy"
        value={`${operations.occupancy.toFixed(0)}%`}
        hint={`${operations.soldNights} nights sold`}
        progress={operations.occupancy}
        tone="emerald"
      />
      <MetricRow
        label="Booking completion"
        value={`${operations.completion.toFixed(0)}%`}
        hint="completed vs cancelled"
        progress={operations.completion}
        tone="blue"
      />
      <MetricRow
        label="Payment performance"
        value={`${operations.performance.toFixed(0)}%`}
        hint="bookings settled"
        progress={operations.performance}
        tone="zinc"
      />
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <MiniMetric label="Active operations" value={operations.activeOperations} />
        <MiniMetric label="Rooms ready" value={housekeeping.available} />
        <MiniMetric label="In cleaning" value={housekeeping.cleaning} tone="amber" />
        <MiniMetric
          label="Blocked rooms"
          value={housekeeping.maintenance + housekeeping.outOfService}
          tone="red"
        />
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  hint,
  progress,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  progress: number;
  tone: "emerald" | "blue" | "zinc";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-600">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-zinc-900">{value}</span>
      </div>
      <ProgressBar value={progress} tone={tone} />
      <p className="mt-1 text-[10px] text-zinc-400">{hint}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "amber" | "red";
}) {
  const colors = {
    zinc: "text-zinc-900",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-2">
      <p className="truncate text-[10px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${colors[tone]}`}>{value}</p>
    </div>
  );
}

export function FinancialPositionWidget({
  financial,
  currency,
}: {
  financial: ExecutiveAnalytics["financial"];
  currency: string;
}) {
  const historyMax = Math.max(1, ...financial.history.map((point) => Math.abs(point.value)));
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          Current balance
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
          {formatMoney(financial.currentBalance, currency)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-zinc-500">Available cash</p>
          <p className="mt-0.5 text-[12px] font-semibold text-zinc-800">
            {formatMoney(financial.availableCash, currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Outstanding</p>
          <p className="mt-0.5 text-[12px] font-semibold text-amber-600">
            {formatMoney(financial.outstanding, currency)}
          </p>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Revenue target</span>
          <span className="tabular-nums">{financial.progress.toFixed(0)}%</span>
        </div>
        <ProgressBar value={financial.progress} tone="emerald" />
        <p className="mt-1 text-[10px] text-zinc-400">
          {formatCompactMoney(financial.target, currency)} target
        </p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Monthly net movement</span>
          <span>12 months</span>
        </div>
        <div className="flex h-14 items-end gap-1">
          {financial.history.map((point, index) => {
            const height = Math.max(6, (Math.abs(point.value) / historyMax) * 100);
            return (
              <div key={`${point.label}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm ${point.value >= 0 ? "bg-emerald-600/80" : "bg-red-500/70"}`}
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${formatMoney(point.value, currency)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-zinc-400">
          <span>{financial.history[0]?.label}</span>
          <span>{financial.history[financial.history.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}

export function ExpenseBreakdownWidget({
  expenses,
  total,
  currency,
}: {
  expenses: ExecutiveAnalytics["expenses"];
  total: number;
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          Total expenses
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
          {formatMoney(total, currency)}
        </p>
      </div>
      {expenses.length > 0 ? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
            {expenses.map((slice) => (
              <span
                key={slice.category}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${slice.pct}%`, backgroundColor: slice.color }}
                title={`${slice.category}: ${slice.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {expenses.map((slice) => (
              <li key={slice.category} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate capitalize text-zinc-600">
                  {slice.category.toLowerCase()}
                </span>
                <span className="tabular-nums text-zinc-500">{slice.pct.toFixed(0)}%</span>
                <span className="w-20 text-right font-medium tabular-nums text-zinc-800">
                  {formatCompactMoney(slice.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="py-6 text-center text-[11px] text-zinc-500">
          No operating expenses recorded for this range.
        </p>
      )}
    </div>
  );
}
