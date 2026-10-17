"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  Coffee,
  Maximize,
  Refrigerator,
  Tv,
  UsersRound,
  Wifi,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, Gallery, ViewAllPhotos } from "@/components/hotel/shared";
import { SearchPanel } from "@/components/hotel/search-panel";
import { BookingSummary, type SummaryRow } from "@/components/hotel/booking-summary";
import {
  bookingHref,
  defaultStayDates,
  formatMoney,
  nightsBetween,
  type ListingRoom,
  type StayQuery,
} from "@/lib/hotel";

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  "Wi-Fi": Wifi,
  "Air Conditioning": Wind,
  TV: Tv,
  "Mini Fridge": Refrigerator,
  "Private Bathroom": Bath,
  "Premium bedding": BedDouble,
  "In-room coffee": Coffee,
};

type HotelProfile = {
  name: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationWindowHours: number;
  currency: string;
};

export function RoomDetailContent({
  room,
  hotel,
  context,
  stay,
  stayError,
  availableRooms,
  nightlyRate,
  estimate,
  searchFailed,
}: {
  room: ListingRoom;
  hotel: HotelProfile;
  context: { taxRatePercent: number; serviceFee: number };
  stay: StayQuery | null;
  stayError: string | null;
  availableRooms: Array<{ id: string; roomNumber: string; floor: number | null }>;
  nightlyRate: string;
  stayTotal: string | null;
  estimate: { subtotal: string; taxes: string; fees: string; total: string } | null;
  searchFailed: boolean;
}) {
  const router = useRouter();
  const [gallery, setGallery] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>(() =>
    stay ? availableRooms.slice(0, stay.quantity).map((physical) => physical.id) : [],
  );

  const nights = stay ? nightsBetween(stay.checkIn, stay.checkOut) : 0;
  const galleryImages = [
    ...room.images,
    "/images/santo-pool.jpg",
    "/images/santo-lobby.jpg",
  ].filter((image, index, list) => list.indexOf(image) === index);

  const canBook = Boolean(stay && selected.length > 0);
  const summaryRows: SummaryRow[] = estimate
    ? [
        { label: `${formatMoney(nightlyRate, hotel.currency)} × ${nights} nights`, value: formatMoney(estimate.subtotal, hotel.currency) },
        { label: `Taxes (${context.taxRatePercent}%)`, value: formatMoney(estimate.taxes, hotel.currency) },
        { label: "Service fee", value: formatMoney(estimate.fees, hotel.currency) },
      ]
    : [];

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const continueToBooking = () => {
    if (!stay || selected.length === 0) return;
    router.push(bookingHref(stay, selected));
  };

  return (
    <div className="container page-content room-detail-page">
      <Breadcrumb current={room.name} />

      <div className="detail-title">
        <div>
          <span className="eyebrow">{room.isSuite ? "THE SUITE COLLECTION" : "YOUR PERSONAL RETREAT"}</span>
          <h1>{room.name}</h1>
          <p>{room.description}</p>
        </div>
        <span className="subtle-badge">Santo accommodation</span>
      </div>

      <div className="mobile-booking-bar">
        <span>
          <strong>{formatMoney(nightlyRate, hotel.currency)}</strong> / night
        </span>
        {canBook ? (
          <Button onClick={continueToBooking}>
            Choose this room <ArrowRight />
          </Button>
        ) : (
          <Button asChild>
            <Link href="/search">Check dates</Link>
          </Button>
        )}
      </div>

      <div className="detail-gallery">
        {galleryImages.slice(0, 3).map((image, index) => (
          <Button
            variant="ghost"
            className={`detail-photo photo-${index}`}
            onClick={() => setGallery(index)}
            key={image}
            aria-label={`View room photo ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={`${room.name} photo ${index + 1}`}
              width={1536}
              height={1024}
            />
          </Button>
        ))}
        <ViewAllPhotos onClick={() => setGallery(0)} />
      </div>

      <div className="detail-layout">
        <section>
          <div className="detail-specs">
            <span>
              <UsersRound />
              {room.maxAdults} guests
            </span>
            <span>
              <BedDouble />
              {room.bed}
            </span>
            <span>
              <Maximize />
              En-suite
            </span>
          </div>
          <h2>Space to settle in.</h2>
          <p>
            Natural materials, soft textures, and a beautifully considered layout. The {room.name}{" "}
            pairs a restful sleeping area with thoughtful spaces for the moments in between.
          </p>
          <p>
            From a quiet morning coffee to the last chapter of a good book, make room for a stay at
            your own pace.
          </p>

          {room.amenities.length > 0 && (
            <>
              <h3>Considered comforts</h3>
              <div className="amenity-grid">
                {room.amenities.map((amenity) => {
                  const Icon = AMENITY_ICONS[amenity] ?? Check;
                  return (
                    <span key={amenity}>
                      <Icon size={20} />
                      {amenity}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          {stay && (
            <section className="room-selection">
              <h3>Choose your room</h3>
              {stayError && <p className="form-error">{stayError}</p>}
              {searchFailed && (
                <p className="form-error">That stay could not be checked — please try again.</p>
              )}
              {!searchFailed && availableRooms.length === 0 && (
                <div className="info-notice">
                  <Check />
                  <p>
                    No {room.name} rooms are free for these dates. Try different dates or explore
                    another room type.
                  </p>
                </div>
              )}
              {availableRooms.length > 0 && (
                <>
                  <div className="room-options">
                    {availableRooms.map((physical) => (
                      <label
                        key={physical.id}
                        className={`room-option ${selected.includes(physical.id) ? "is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(physical.id)}
                          onChange={() => toggle(physical.id)}
                        />
                        <span>
                          <strong>Room {physical.roomNumber}</strong>
                          {physical.floor !== null && <small>Floor {physical.floor}</small>}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button onClick={continueToBooking} disabled={selected.length === 0}>
                    Continue to booking <ArrowRight />
                  </Button>
                </>
              )}
            </section>
          )}

          {[
            [
              "Check-in & check-out",
              `Check-in from ${hotel.checkInTime}, check-out by ${hotel.checkOutTime}.`,
            ],
            [
              "Cancellation & payment",
              `Free cancellation up to ${hotel.cancellationWindowHours} hours before check-in. Payment is completed through the hotel's secure payment page.`,
            ],
            [
              "Accessibility",
              "Room-specific accessibility information is available from our team. Please contact the hotel before making travel arrangements.",
            ],
            [
              "House rules",
              "Smoking, pet, visitor and quiet-hour policies are confirmed by the hotel at check-in.",
            ],
          ].map(([title, copy]) => (
            <details key={title} className="faq">
              <summary>{title}</summary>
              <p>{copy}</p>
            </details>
          ))}
        </section>

        <BookingSummary
          image={room.images[0]}
          title={room.name}
          checkIn={stay?.checkIn ?? "Select your dates"}
          checkOut={stay?.checkOut ?? ""}
          guests={
            stay
              ? `${stay.adults} adults · ${stay.children} children · ${stay.quantity} room${stay.quantity === 1 ? "" : "s"}`
              : "Your dates, your way"
          }
          rows={summaryRows}
          total={estimate?.total ?? null}
          currency={hotel.currency}
          note={
            estimate
              ? "Price for one room. Taxes and fees are confirmed at checkout."
              : stayError ?? "Select your dates to see live availability and the full stay total."
          }
          search={
            <div className="summary-search">
              <SearchPanel
                compact
                defaults={stay ?? { ...defaultStayDates(), adults: 2, children: 0, quantity: 1 }}
              />
            </div>
          }
        >
          {stay && availableRooms.length > 0 && (
            <Button asChild className="w-full">
              <Link
                href={bookingHref(
                  stay,
                  availableRooms.slice(0, stay.quantity).map((physical) => physical.id),
                )}
              >
                Choose this room <ArrowRight />
              </Link>
            </Button>
          )}
          {stay && (
            <p className="policy-note">
              <Check size={14} />
              {availableRooms.length > 0
                ? `${availableRooms.length} room${availableRooms.length === 1 ? "" : "s"} available`
                : "No rooms available for these dates"}
            </p>
          )}
        </BookingSummary>
      </div>

      <Gallery images={galleryImages} open={gallery} setOpen={setGallery} />
    </div>
  );
}
