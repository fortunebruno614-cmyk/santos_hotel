import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UsersRound, BedDouble, Maximize, Grid2X2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, Gallery, Amenities, SearchPanel, roomImage } from "@/components/hotel/shared";
import { useBooking } from "@/components/hotel/booking-context";
import { rooms, lobby, meta, stayTotal } from "@/lib/hotel-data";
import pool from "@/assets/santo-pool.jpg";
export const Route = createFileRoute("/rooms/$roomId")({
  head: ({ params }) =>
    meta(
      rooms.find((r) => r.id === params.roomId)?.name ?? "Room details",
      "Discover thoughtfully considered comforts, room photography and a sample stay at Santo Hotel.",
    ),
  component: RoomDetails,
});
function RoomDetails() {
  const { roomId } = Route.useParams();
  const r = rooms.find((r) => r.id === roomId);
  const [gallery, setGallery] = useState<number | null>(null);
  const { price, booking, nights, update } = useBooking();
  if (!r)
    return (
      <div className="container empty-state">
        <h1>Room not found</h1>
        <Button asChild>
          <Link to="/rooms">Explore rooms</Link>
        </Button>
      </div>
    );
  const images = [roomImage(r), pool, lobby];
  return (
    <div className="container page-content room-detail-page">
      <Breadcrumb current={r.name} />
      <div className="detail-title">
        <div>
          <span className="eyebrow">YOUR PERSONAL RETREAT</span>
          <h1>{r.name}</h1>
          <p>{r.description}</p>
        </div>
        <span className="subtle-badge">Sample accommodation</span>
      </div>
      <div className="mobile-booking-bar"><span><strong>{price(r.price)}</strong> / night</span><Button asChild onClick={() => update({ roomId: r.id })}><Link to="/checkout">Choose this room<ArrowRight/></Link></Button></div>
      <div className="detail-gallery">
        {images.map((img, i) => (
          <Button
            variant="ghost"
            className={`detail-photo photo-${i}`}
            onClick={() => setGallery(i)}
            key={img}
            aria-label={`View room photo ${i + 1}`}
          >
            <img
              src={img}
              alt={`${r.name} illustrative photo ${i + 1}`}
              width={1536}
              height={1024}
            />
          </Button>
        ))}
        <Button className="all-photos" variant="secondary" onClick={() => setGallery(0)}>
          <Grid2X2 />
          View all photos
        </Button>
      </div>
      <div className="detail-layout">
        <section>
          <div className="detail-specs">
            <span>
              <UsersRound />
              {r.guests} guests
            </span>
            <span>
              <BedDouble />
              {r.bed}
            </span>
            <span>
              <Maximize />
              {r.size} m²
            </span>
          </div>
          <h2>Space to settle in.</h2>
          <p>
            Natural materials, soft textures, and a beautifully considered layout. This sample{" "}
            {r.name.toLowerCase()} pairs a restful sleeping area with thoughtful spaces for the
            moments in between.
          </p>
          <p>
            From a quiet morning coffee to the last chapter of a good book, make room for a stay at
            your own pace.
          </p>
          <h3>Considered comforts</h3>
          <Amenities />
          <p className="tiny-note">Illustrative amenities, not confirmed hotel facilities.</p>
          {[
            [
              "Bathroom & facilities",
              "Sample layout: private bathroom with shower, fresh towels and toiletries. Actual facilities to be confirmed.",
            ],
            [
              "Accessibility",
              "Room-specific accessibility information is awaiting confirmation. Please contact the hotel before making travel arrangements.",
            ],
            [
              "Check-in, check-out & house rules",
              "Arrival and departure times, guest policies and house rules will be confirmed by the hotel.",
            ],
            [
              "Cancellation & payment",
              "Cancellation deadlines, payment timing and any applicable charges are placeholders in this prototype. No payments are collected.",
            ],
          ].map(([title, copy]) => (
            <details key={title} className="faq">
              <summary>{title}</summary>
              <p>{copy}</p>
            </details>
          ))}
        </section>
        <aside className="booking-summary sticky-summary">
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h3>Your Santo stay</h3>
          <div className="summary-price">
            <strong>{price(r.price)}</strong> / night
          </div>
          <SearchPanel compact />
          <div className="price-row">
            <span>
              {nights} nights · {booking.quantity} room
            </span>
            <strong>{price(r.price * nights * booking.quantity)}</strong>
          </div>
          <div className="price-row">
            <span>Mock taxes & fees</span>
            <span>{price(stayTotal(r.price, nights, booking.quantity).fees)}</span>
          </div>
          <div className="price-row total">
            <span>Total stay</span>
            <strong>{price(stayTotal(r.price, nights, booking.quantity).total)}</strong>
          </div>
          <Button asChild onClick={() => update({ roomId: r.id })}>
            <Link to="/checkout">
              Choose this room <ArrowRight />
            </Link>
          </Button>
          <p className="policy-note">
            <Check size={14} />
            No payment collected in this demo.
          </p>
          <p className="tiny-note">Hotel policies and fees to be confirmed.</p>
        </aside>
      </div>
      <Gallery images={images} open={gallery} setOpen={setGallery} />
    </div>
  );
}
