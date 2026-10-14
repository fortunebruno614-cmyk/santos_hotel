import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  UsersRound,
  BedDouble,
  Maximize,
  Wifi,
  Coffee,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  Leaf,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBooking } from "./booking-context";
import { type Room } from "@/lib/hotel-data";
export const roomImage = (room: Room) => room.image;
export function Breadcrumb({ current }: { current: string }) {
  return (
    <div className="breadcrumb">
      <Link to="/">Home</Link>
      <ChevronRight size={12} />
      <span>{current}</span>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
export function SearchPanel({ compact = false }: { compact?: boolean }) {
  const { booking, update } = useBooking();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <form
      className={`search-panel ${compact ? "compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (booking.checkOut <= booking.checkIn) {
          setError("Check-out must be after check-in.");
          return;
        }
        setError("");
        navigate({ to: "/availability" });
      }}
    >
      <label className="search-field">
        <span>
          <CalendarDays /> CHECK-IN
        </span>
        <input
          aria-label="Check-in"
          type="date"
          required
          value={booking.checkIn}
          onChange={(e) => update({ checkIn: e.target.value })}
        />
      </label>
      <label className="search-field">
        <span>
          <CalendarDays /> CHECK-OUT
        </span>
        <input
          aria-label="Check-out"
          type="date"
          required
          value={booking.checkOut}
          min={booking.checkIn}
          onChange={(e) => update({ checkOut: e.target.value })}
        />
      </label>
      <label className="search-field small">
        <span>
          <UsersRound /> ADULTS
        </span>
        <select
          aria-label="Adults"
          value={booking.adults}
          onChange={(e) => update({ adults: +e.target.value })}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "Adult" : "Adults"}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>CHILDREN</span>
        <select
          aria-label="Children"
          value={booking.children}
          onChange={(e) => update({ children: +e.target.value })}
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "Child" : "Children"}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>
          <BedDouble /> ROOMS
        </span>
        <select
          aria-label="Rooms"
          value={booking.quantity}
          onChange={(e) => update({ quantity: +e.target.value })}
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "Room" : "Rooms"}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" className="search-submit">
        <Search size={17} />
        Search availability
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function RoomCard({ room, horizontal = false }: { room: Room; horizontal?: boolean }) {
  const { price, update, nights, booking } = useBooking();
  return (
    <article className={`room-card ${horizontal ? "horizontal" : ""}`}>
      <Link to="/rooms/$roomId" params={{ roomId: room.id }} className="room-photo">
        <img src={roomImage(room)} alt={room.name} width={1536} height={1024} loading="lazy" />
        <span className="photo-tag">{room.tag}</span>
        <span className="photo-arrow">
          <ArrowRight size={18} />
        </span>
      </Link>
      <div className="room-card-body">
        <div className="room-card-main">
          <span className="room-category">
            {room.category === "Suites" ? "THE SUITE COLLECTION" : "YOUR PERSONAL RETREAT"}
          </span>
          <h3>
            <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
              {room.name}
            </Link>
          </h3>
          <p>{room.description}</p>
          <div className="room-specs">
            <span>
              <UsersRound /> {room.guests} guests
            </span>
            <span>
              <BedDouble /> {room.bed}
            </span>
            <span>
              <Maximize /> {room.size} m²
            </span>
          </div>
          {horizontal && (
            <>
              <div className="room-specs">
                <span>
                  <Wifi /> Wi-Fi
                </span>
                <span>
                  <Coffee /> {room.breakfast ? "Breakfast included" : "Breakfast optional"}
                </span>
              </div>
              <p className="policy-note">
                <Check size={14} /> Cancellation terms to be confirmed
              </p>
            </>
          )}
        </div>
        <div className="room-card-bottom">
          <div>
            <span className="rate-from">From </span>
            <strong>{price(room.price)}</strong>
            <span className="rate-unit"> / night</span>
            {horizontal && (
              <small>
                {price(room.price * nights * booking.quantity)} for {nights} nights · before mock
                fees
              </small>
            )}
          </div>
          <div className="room-card-links">
            <Link to="/rooms/$roomId" params={{ roomId: room.id }} className="text-link">
              {horizontal ? "View details" : "View room"}
              <ArrowRight size={15} />
            </Link>
            {horizontal && (
              <Button asChild onClick={() => update({ roomId: room.id })}>
                <Link to="/checkout">Choose room</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
export function Gallery({
  images,
  open,
  setOpen,
}: {
  images: string[];
  open: number | null;
  setOpen: (v: number | null) => void;
}) {
  return (
    <Dialog
      open={open !== null}
      onOpenChange={(v) => {
        if (!v) setOpen(null);
      }}
    >
      <DialogContent className="gallery-dialog">
        <DialogTitle>A closer look at Santo</DialogTitle>
        <DialogDescription>
          Illustrative hotel photography · {open === null ? 1 : open + 1} of {images.length}
        </DialogDescription>
        <img src={images[open ?? 0]} alt="Illustrative Santo Hotel gallery" />
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setOpen(((open ?? 0) - 1 + images.length) % images.length)}
          >
            <ChevronLeft />
            Previous
          </Button>
          <Button variant="outline" onClick={() => setOpen(((open ?? 0) + 1) % images.length)}>
            Next
            <ChevronRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function Amenities() {
  return (
    <div className="amenity-grid">
      {[
        [Wifi, "Complimentary Wi-Fi"],
        [Coffee, "In-room coffee"],
        [BedDouble, "Premium bedding"],
        [Leaf, "Thoughtful comforts"],
      ].map(([Icon, label]) => {
        const I = Icon as typeof Wifi;
        return (
          <span key={String(label)}>
            <I size={20} />
            {String(label)}
          </span>
        );
      })}
    </div>
  );
}
export function FilterIcon() {
  return <SlidersHorizontal size={17} />;
}
