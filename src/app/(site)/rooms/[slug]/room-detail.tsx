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
  MapPin,
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
import { SearchMap } from "@/components/hotel/search-map";
import { isMapEnabled } from "@/config/maps";
import { BookingSummary, type SummaryRow } from "@/components/hotel/booking-summary";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";
import { useT } from "@/components/hotel/locale-provider";
import {
  bookingHref,
  defaultStayDates,
  formatMoney,
  nightsBetween,
  type HotelLocation,
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
  location,
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
  location: HotelLocation;
  nightlyRate: string;
  stayTotal: string | null;
  estimate: { subtotal: string; taxes: string; fees: string; total: string } | null;
  searchFailed: boolean;
}) {
  const router = useRouter();
  const display = useDisplayCurrency();
  const t = useT();
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
        {
          label: t("summary.nightRow", {
            rate: formatMoney(nightlyRate, hotel.currency, display),
            nights,
            unit: nights === 1 ? t("room.night") : t("room.nights"),
          }),
          value: formatMoney(estimate.subtotal, hotel.currency, display),
        },
        {
          label: t("summary.taxesRow", { percent: context.taxRatePercent }),
          value: formatMoney(estimate.taxes, hotel.currency, display),
        },
        {
          label: t("summary.serviceFeeRow"),
          value: formatMoney(estimate.fees, hotel.currency, display),
        },
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

  /** Jump to the room map without making the guest hunt for it (MR-07). */
  const openMap = () => {
    const target = document.getElementById("room-map");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus too, so keyboard and screen-reader users land on it.
    target.focus({ preventScroll: true });
  };

  return (
    <div className="container page-content room-detail-page">
      <Breadcrumb current={room.name} />

      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {room.isSuite ? t("room.categorySuite") : t("room.categoryRetreat")}
          </span>
          <h1>{room.name}</h1>
          {isMapEnabled() && (
            /* Sits with the name so the location is one click away, instead of
             * buried at the foot of the page. Hidden entirely when no Maps key
             * is configured — same rule the List/Map toggle follows. */
            <button type="button" className="room-map-link" onClick={openMap}>
              <MapPin size={15} aria-hidden="true" />
              {t("detail.openMap")}
            </button>
          )}
          <p>{room.description}</p>
        </div>
        <span className="subtle-badge">{t("detail.badge")}</span>
      </div>

      <div className="mobile-booking-bar">
        <span>
          <strong>{formatMoney(nightlyRate, hotel.currency, display)}</strong>{" "}
          {t("room.perNight")}
        </span>
        {canBook ? (
          <Button onClick={continueToBooking}>
            {t("detail.chooseThisRoom")} <ArrowRight />
          </Button>
        ) : (
          <Button asChild>
            <Link href="/search">{t("detail.checkDates")}</Link>
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
            aria-label={t("detail.viewPhoto", { index: index + 1 })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={t("detail.photoAlt", { name: room.name, index: index + 1 })}
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
              {t("room.guests", { count: room.maxAdults })}
            </span>
            <span>
              <BedDouble />
              {room.bed}
            </span>
            <span>
              <Maximize />
              {t("room.ensuite")}
            </span>
          </div>
          <h2>{t("detail.spaceTitle")}</h2>
          <p>{t("detail.spaceBody1", { name: room.name })}</p>
          <p>{t("detail.spaceBody2")}</p>

          {room.amenities.length > 0 && (
            <>
              <h3>{t("detail.comforts")}</h3>
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
              <h3>{t("detail.chooseRoom")}</h3>
              {stayError && <p className="form-error">{stayError}</p>}
              {searchFailed && <p className="form-error">{t("detail.searchFailed")}</p>}
              {!searchFailed && availableRooms.length === 0 && (
                <div className="info-notice">
                  <Check />
                  <p>{t("detail.noneFree", { name: room.name })}</p>
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
                          <strong>{t("home.inventory.room", { number: physical.roomNumber })}</strong>
                          {physical.floor !== null && (
                            <small>{t("home.inventory.floor", { floor: physical.floor })}</small>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button onClick={continueToBooking} disabled={selected.length === 0}>
                    {t("detail.continueBooking")} <ArrowRight />
                  </Button>
                </>
              )}
            </section>
          )}

          {(
            [
              [
                t("detail.faq.checkInTitle"),
                t("detail.faq.checkInBody", {
                  inTime: hotel.checkInTime,
                  outTime: hotel.checkOutTime,
                }),
              ],
              [
                t("detail.faq.cancellationTitle"),
                t("detail.faq.cancellationBody", {
                  hours: hotel.cancellationWindowHours,
                }),
              ],
              [t("detail.faq.accessibilityTitle"), t("detail.faq.accessibilityBody")],
              [t("detail.faq.houseRulesTitle"), t("detail.faq.houseRulesBody")],
            ] as const
          ).map(([title, copy]) => (
            <details key={title} className="faq">
              <summary>{title}</summary>
              <p>{copy}</p>
            </details>
          ))}
        </section>

        <BookingSummary
          image={room.images[0]}
          title={room.name}
          checkIn={stay?.checkIn ?? t("summary.selectDates")}
          checkOut={stay?.checkOut ?? ""}
          guests={
            stay
              ? t("summary.guestsLine", {
                  adults: stay.adults,
                  children: stay.children,
                  quantity: stay.quantity,
                  unit: stay.quantity === 1 ? t("summary.room") : t("summary.rooms"),
                })
              : t("summary.yourDates")
          }
          rows={summaryRows}
          total={estimate?.total ?? null}
          currency={hotel.currency}
          displayCurrency={display}
          note={
            estimate
              ? t("summary.priceNote")
              : stayError ?? t("summary.selectDatesNote")
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
                {t("detail.chooseThisRoom")} <ArrowRight />
              </Link>
            </Button>
          )}
          {stay && (
            <p className="policy-note">
              <Check size={14} />
              {availableRooms.length > 0
                ? t("summary.availableCount", {
                    count: availableRooms.length,
                    unit:
                      availableRooms.length === 1 ? t("summary.room") : t("summary.rooms"),
                  })
                : t("summary.noneAvailable")}
            </p>
          )}
        </BookingSummary>
      </div>

      {isMapEnabled() && (
        /* Every room page pins the hotel's verified position (MR-07). The one
         * room on screen is both the full set and the current result, so the
         * pin card lists just this room. Without dates the card carries its
         * base rate — `SearchMap` never quotes a price the server hasn't set. */
        <section
          id="room-map"
          tabIndex={-1}
          className="room-detail-map"
          aria-label={t("listing.mapAria")}
        >
          <h2>{t("detail.mapTitle")}</h2>
          <p className="tiny-note">{location.address ?? location.name}</p>
          <div className="room-detail-map-frame">
            <SearchMap
              location={location}
              rooms={[room]}
              results={[room]}
              stay={stay ?? undefined}
              currency={hotel.currency}
            />
          </div>
        </section>
      )}

      <Gallery images={galleryImages} open={gallery} setOpen={setGallery} />
    </div>
  );
}
