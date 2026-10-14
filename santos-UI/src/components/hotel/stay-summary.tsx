import { Link } from "@tanstack/react-router";
import { CalendarDays, UsersRound } from "lucide-react";
import { useBooking } from "./booking-context";
import { roomImage } from "./shared";
import { stayTotal } from "@/lib/hotel-data";
export function StaySummary() {
  const { selected, booking, nights, price, currency } = useBooking();
  const totals = stayTotal(selected.price, nights, booking.quantity);
  return (
    <aside className="booking-summary">
      <img className="summary-photo" src={roomImage(selected)} alt={selected.name} />
      <div className="summary-inner">
        <span className="eyebrow">YOUR SELECTION</span>
        <h3>{selected.name}</h3>
        <p className="summary-meta">
          <CalendarDays size={16} />
          {booking.checkIn} — {booking.checkOut}
        </p>
        <p className="summary-meta">
          <UsersRound size={16} />
          {booking.adults} adults · {booking.children} children · {booking.quantity} room
        </p>
        <div className="price-row">
          <span>
            {price(selected.price)} × {nights} nights × {booking.quantity}
          </span>
          <span>{price(totals.subtotal)}</span>
        </div>
        <div className="price-row">
          <span>Mock taxes & fees</span>
          <span>{price(totals.fees)}</span>
        </div>
        <div className="price-row total">
          <span>Total stay</span>
          <strong>{price(totals.total)}</strong>
        </div>
        <p className="tiny-note">
          Illustrative price in {currency}. Cancellation and payment terms to be
          confirmed.
        </p>
        <Link to="/rooms" className="text-link">
          Change room
        </Link>
      </div>
    </aside>
  );
}
