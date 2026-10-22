import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";
import { formatMoney } from "@/lib/hotel";

export type SummaryRow = {
  label: string;
  value: string;
  tone?: "default" | "total";
};

export function BookingSummary({
  image,
  title,
  checkIn,
  checkOut,
  guests,
  rows,
  total,
  currency,
  displayCurrency,
  note,
  changeHref,
  search,
  children,
}: {
  image: string;
  title: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  rows: SummaryRow[];
  total?: string | null;
  currency: string;
  displayCurrency?: string;
  note?: string;
  changeHref?: string;
  search?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <aside className="booking-summary">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="summary-photo" src={image} alt={title} />
      <div className="summary-inner">
        <span className="eyebrow">YOUR SELECTION</span>
        <h3>{title}</h3>
        <p className="summary-meta">
          <CalendarDays size={16} />
          {checkIn} — {checkOut}
        </p>
        <p className="summary-meta">
          <UsersRound size={16} />
          {guests}
        </p>
        {search}
        {rows.map((row) => (
          <div className="price-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
        {total && (
          <div className="price-row total">
            <span>Total stay</span>
            <strong>{formatMoney(total, currency, displayCurrency)}</strong>
          </div>
        )}
        {note && <p className="tiny-note">{note}</p>}
        {changeHref && (
          <Link href={changeHref} className="text-link">
            Change room
          </Link>
        )}
        {children}
      </div>
    </aside>
  );
}
