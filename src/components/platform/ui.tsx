import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dark platform-console primitives. Everything here is presentation only and
 * can be imported from server or client components.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  danger: "border-red-400/20 bg-red-400/10 text-red-300",
  accent: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
};

const STATUS_TONES: Record<string, Tone> = {
  // Organization
  PROVISIONING: "info",
  ACTIVE: "success",
  SUSPENDED: "warning",
  CLOSED: "danger",
  // Publication
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  PUBLISHED: "success",
  PAUSED: "warning",
  ARCHIVED: "neutral",
  // KYC
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  // Booking
  CONFIRMED: "info",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  // Payment
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "info",
  PARTIALLY_REFUNDED: "info",
  // Operators
  ADMIN: "accent",
  OPERATIONS: "info",
  SUPPORT: "neutral",
  OWNER: "accent",
  MANAGER: "info",
  STAFF: "neutral",
  GUEST: "neutral",
  // Generic
  VERIFIED: "success",
  UNVERIFIED: "neutral",
  SUCCESS: "success",
  BUILDING: "info",
  QUEUED: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  PROVISIONING: "Provisioning",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  ADMIN: "Admin",
  OPERATIONS: "Operations",
  SUPPORT: "Support",
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  GUEST: "Guest",
};

export function StatusPill({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  label?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.68rem] font-medium whitespace-nowrap",
        TONES[tone ?? STATUS_TONES[status] ?? "neutral"],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
        {description && (
          <p className="max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-[#111b2b] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_18px_50px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function MiniSparkline({
  values,
  color = "#06b6d4",
  width = 120,
  height = 38,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const safe = values.length > 1 ? values : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const points = safe.map((value, index) => {
    const x = (index / (safe.length - 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 10);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `spark-${color.replace("#", "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Trend({
  value,
  suffix = "%",
  neutral = false,
  className,
}: {
  value: number | null;
  suffix?: string;
  neutral?: boolean;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-[0.7rem] text-slate-500", className)}>—</span>;
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const tone = neutral
    ? "text-slate-400"
    : positive
      ? "text-emerald-400"
      : "text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[0.7rem] font-medium", tone, className)}>
      <Icon className="size-3" strokeWidth={2.2} />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  series,
  accent = "#06b6d4",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  series?: number[];
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Panel className="group relative overflow-hidden p-5 transition-colors hover:border-white/[0.12]">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        {icon && (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"
            style={{ color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {typeof delta !== "undefined" ? <Trend value={delta} /> : <span />}
        {series && series.length > 1 && (
          <MiniSparkline values={series} color={accent} width={110} height={34} />
        )}
      </div>
    </Panel>
  );
}

export function Donut({
  segments,
  total,
  label,
  size = 148,
  thickness = 12,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
  label?: string;
  size?: number;
  thickness?: number;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.map((segment, index) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const dash = fraction * circumference;
    const offset = segments
      .slice(0, index)
      .reduce(
        (sum, previous) =>
          sum + (total > 0 ? (previous.value / total) * circumference : 0),
        0,
      );
    return { segment, dash, offset };
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={thickness}
          />
          {arcs.map(({ segment, dash, offset }) => (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-50">{total}</span>
          {label && <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</span>}
        </div>
      </div>
      <ul className="space-y-2 text-xs">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-slate-400">
            <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="min-w-20">{segment.label}</span>
            <span className="font-medium tabular-nums text-slate-200">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "primary" | "danger";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "p-btn",
        variant === "primary" && "p-btn-primary",
        variant === "danger" && "p-btn-danger",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

export function formatMoney(value: number, currency = "NGN", maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

export function formatCompactMoney(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}
