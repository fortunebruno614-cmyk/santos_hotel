import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>}
          </div>
          {action ?? (
            <button
              type="button"
              aria-label="Widget options"
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        </header>
      )}
      <div className={cn("min-w-0 flex-1 px-4 py-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Delta({
  value,
  suffix = "%",
  neutral = false,
  className,
}: {
  value: number;
  suffix?: string;
  neutral?: boolean;
  className?: string;
}) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const tone = neutral
    ? "text-zinc-500"
    : positive
      ? "text-emerald-700"
      : "text-red-600";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", tone, className)}>
      <Icon size={12} strokeWidth={2.2} />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function Sparkline({
  values,
  color = "#047857",
  fill = "rgba(4,120,87,0.08)",
  width = 96,
  height = 28,
}: {
  values: number[];
  color?: string;
  fill?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="block h-7 w-24 rounded bg-zinc-50" aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 3 - ((value - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({
  value,
  tone = "emerald",
  className,
}: {
  value: number;
  tone?: "emerald" | "blue" | "amber" | "zinc" | "red";
  className?: string;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    zinc: "bg-zinc-700",
    red: "bg-red-600",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <div
        className={cn("h-full rounded-full transition-[width]", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function formatCompactMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMoney(value: number, currency: string, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
