import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared staff-console building blocks.
 *
 * The console keeps one visual language across every screen: a warm neutral
 * canvas, white cards with a hairline border, compact tables with a tinted
 * header row, and one primary action per view. Pages compose these primitives
 * instead of repeating utility classes, so a new screen cannot drift again.
 */

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-zinc-200 bg-zinc-100 text-zinc-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  accent: "border-primary/20 bg-primary/10 text-primary",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium leading-5 whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  // Booking lifecycle
  PENDING: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  // Payment lifecycle
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "info",
  PARTIALLY_REFUNDED: "info",
  UNPAID: "neutral",
  // Publication / activation
  PUBLISHED: "success",
  DRAFT: "warning",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  PAUSED: "warning",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
  ACTIVE: "success",
  INACTIVE: "neutral",
  // Business verification
  APPROVED: "success",
  REJECTED: "danger",
  // Housekeeping
  AVAILABLE: "success",
  RESERVED: "warning",
  OCCUPIED: "info",
  CLEANING: "warning",
  MAINTENANCE: "danger",
  OUT_OF_SERVICE: "danger",
  // Email delivery
  SENT: "success",
};

export function humanizeStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} className={className}>
      {label ?? humanizeStatus(status)}
    </Badge>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span aria-hidden>←</span> {backLabel}
          </Link>
        )}
        {eyebrow && (
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("admin-card", className)}>{children}</section>;
}

export function CardHeader({
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
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs leading-5 text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-table-wrap", className)}>
      <table className="admin-table">{children}</table>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="admin-empty-row">
        {children}
      </td>
    </tr>
  );
}

const NOTICE_TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-6",
        NOTICE_TONES[tone],
        className,
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-0.5")}>{children}</div>
    </div>
  );
}

export function InlineError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {children}
    </p>
  );
}

export function InlineSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {children}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="admin-card p-5">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function pageWindow(page: number, pages: number): Array<number | "gap"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const values = new Set<number>([1, pages, page - 1, page, page + 1]);
  const sorted = [...values].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  const output: Array<number | "gap"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) output.push("gap");
    output.push(value);
  });
  return output;
}

export function Pagination({
  page,
  pages,
  hrefFor,
  className,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className={cn("flex flex-wrap items-center gap-1.5 text-sm", className)} aria-label="Pagination">
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
        Previous
      </PageLink>
      {pageWindow(page, pages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1.5 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <PageLink key={entry} href={hrefFor(entry)} current={entry === page}>
            {entry}
          </PageLink>
        ),
      )}
      <PageLink href={hrefFor(page + 1)} disabled={page >= pages}>
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  current,
  disabled,
  children,
}: {
  href: string;
  current?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-xs font-medium transition-colors",
    current
      ? "border-primary bg-primary text-primary-foreground"
      : "border-[var(--admin-line)] bg-card text-foreground hover:bg-muted",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "admin-card flex flex-wrap items-end gap-3 px-4 py-3.5 text-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ResultCount({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}
