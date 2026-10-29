"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Map as MapIcon, RotateCcw, SearchX, SlidersHorizontal, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading, RoomCard } from "@/components/hotel/shared";
import { SearchPanel } from "@/components/hotel/search-panel";
import { SearchMap } from "@/components/hotel/search-map";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";
import { isMapEnabled } from "@/config/maps";
import {
  bookingHref,
  defaultStayDates,
  formatMoney,
  nightsBetween,
  searchHref,
  type HotelLocation,
  type ListingRoom,
  type StayQuery,
} from "@/lib/hotel";

/**
 * Rooms listing with the List/Map view switch (MR-01..MR-06).
 *
 * The view mode is transient page state (MRD decision #4): it lives in this
 * component only, never in the URL, so search params stay shareable and
 * switching views preserves dates, filters, sort, currency and selection.
 * The map is offered on availability results only — it pins the hotel's
 * verified position with its lowest nightly rate and mirrors the filtered
 * results in the pin's card (see `SearchMap`). The /rooms catalogue and
 * undated searches stay a clean list.
 *
 * The toggle only renders when a Maps API key is configured — without one the
 * page behaves exactly as the plain list always has.
 */
export function Listing({
  mode = "catalog",
  rooms,
  stay,
  currency,
  location,
  errorMessage,
  policyNote,
  eyebrow,
  title,
  description,
}: {
  mode?: "catalog" | "availability";
  rooms: ListingRoom[];
  stay?: StayQuery;
  currency: string;
  location?: HotelLocation;
  errorMessage?: string | null;
  policyNote?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const availability = mode === "availability";
  const display = useDisplayCurrency();
  const [type, setType] = useState("All");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [guests, setGuests] = useState("Any");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Map/list mode: transient page state, independent of the URL (MRD #4).
  // The pinned price map is an availability-results feature: the /rooms
  // catalogue and undated searches stay a clean list.
  const mapEnabled = isMapEnabled() && Boolean(location) && availability;
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const listViewScrollY = useRef<number | null>(null);

  const switchView = (next: "list" | "map") => {
    if (next === view) return;
    if (next === "map") {
      listViewScrollY.current = window.scrollY;
    }
    setView(next);
  };

  // On mobile the panes swap entirely; put the reader back where they were
  // in the list instead of dumping them at the top of the page.
  useEffect(() => {
    if (view === "list" && listViewScrollY.current !== null) {
      const y = listViewScrollY.current;
      listViewScrollY.current = null;
      window.scrollTo({ top: y });
    }
  }, [view]);

  const searchDefaults: StayQuery =
    stay ?? { ...defaultStayDates(), adults: 2, children: 0, quantity: 1 };

  const bounds = useMemo(() => {
    const prices = rooms.map((room) =>
      Number(room.price?.nightlyRate ?? room.basePrice),
    );
    const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
    const maxPrice =
      prices.length > 0 ? Math.max(minPrice + 1, Math.ceil(Math.max(...prices))) : 1;
    return {
      min: minPrice,
      max: maxPrice,
      amenities: [...new Set(rooms.flatMap((room) => room.amenities))].slice(0, 4),
    };
  }, [rooms]);

  const activeMax = maxPrice ?? bounds.max;

  const reset = () => {
    setType("All");
    setMaxPrice(null);
    setGuests("Any");
    setSelectedAmenities([]);
    setSort("recommended");
  };

  let results = rooms.filter((room) => {
    const nightly = Number(room.price?.nightlyRate ?? room.basePrice);
    if (type === "Rooms" && room.isSuite) return false;
    if (type === "Suites" && !room.isSuite) return false;
    if (nightly > activeMax) return false;
    if (guests !== "Any" && room.maxAdults < Number(guests)) return false;
    if (selectedAmenities.some((amenity) => !room.amenities.includes(amenity))) return false;
    if (availability && stay) {
      if (!room.availableCount || room.availableCount < stay.quantity) return false;
    }
    return true;
  });

  results = [...results].sort((a, b) => {
    const aPrice = Number(a.price?.nightlyRate ?? a.basePrice);
    const bPrice = Number(b.price?.nightlyRate ?? b.basePrice);
    if (sort === "low") return aPrice - bPrice;
    if (sort === "high") return bPrice - aPrice;
    return 0;
  });

  const nights = stay ? nightsBetween(stay.checkIn, stay.checkOut) : 0;

  const showMap = mapEnabled && view === "map";

  return (
    <div className="container page-content">
      <Breadcrumb current={availability ? "Availability" : "Rooms & Suites"} />
      <PageHeading
        eyebrow={eyebrow ?? (availability ? "YOUR SANTO STAY" : "ROOMS & SUITES")}
        title={title ?? (availability ? "Your stay starts here." : "Find your perfect stay.")}
        description={
          description ??
          "Beautifully considered rooms. All the space you need to feel at home."
        }
      />
      <SearchPanel compact defaults={searchDefaults} />

      {mapEnabled && (
        <div className="view-switch" role="group" aria-label="Choose room view">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => switchView("list")}
          >
            <List aria-hidden="true" />
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => switchView("map")}
          >
            <MapIcon aria-hidden="true" />
            Map
          </button>
          {/* Selection is also exposed as text, not colour alone (WCAG). */}
          <span className="visually-hidden" role="status">
            {view === "map"
              ? "Map view. Room list and filters are still available."
              : "List view."}
          </span>
        </div>
      )}

      <div
        className={`listing-layout${showMap ? " with-map" : ""}`}
        data-view={mapEnabled ? view : undefined}
      >
        <aside className={`filters ${filtersOpen ? "is-open" : ""}`}>
          <div className="filter-heading">
            <h3>Refine your stay</h3>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
          <fieldset>
            <legend>Room type</legend>
            {["All", "Rooms", "Suites"].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                />
                {value === "All" ? "All accommodation" : value}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Nightly budget</legend>
            <input
              aria-label="Maximum nightly price"
              type="range"
              min={bounds.min}
              max={bounds.max}
              step="5"
              value={activeMax}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>{formatMoney(bounds.min, currency, display)}</span>
              <span>Up to {formatMoney(activeMax, currency, display)}</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Guests</legend>
            <select
              aria-label="Minimum room capacity"
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
            >
              <option>Any</option>
              <option value="2">2 guests</option>
              <option value="3">3 guests</option>
              <option value="4">4 guests</option>
            </select>
          </fieldset>
          {bounds.amenities.length > 0 && (
            <fieldset>
              <legend>The little extras</legend>
              {bounds.amenities.map((amenity) => (
                <label key={amenity}>
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={(event) =>
                      setSelectedAmenities((current) =>
                        event.target.checked
                          ? [...current, amenity]
                          : current.filter((item) => item !== amenity),
                      )
                    }
                  />
                  {amenity}
                </label>
              ))}
            </fieldset>
          )}
          <p className="tiny-note">
            Rates and availability are confirmed by the hotel when your reservation is processed.
          </p>
          <Button className="filter-done" onClick={() => setFiltersOpen(false)}>
            Show rooms
          </Button>
        </aside>

        <section className="listing-results">
          <div className="results-toolbar">
            <div>
              <h3>
                {errorMessage
                  ? "We need a little more detail"
                  : `${results.length} ${results.length === 1 ? "room" : "rooms"} to make your own`}
              </h3>
              <small>
                {availability && stay
                  ? `${stay.checkIn} → ${stay.checkOut} · ${nights} ${nights === 1 ? "night" : "nights"}`
                  : "Live room catalogue · Rates per night"}
              </small>
            </div>
            <Button
              variant="outline"
              className="filter-toggle"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal />
              Filters
            </Button>
            <label className="sort-label">
              Sort by{" "}
              <select
                aria-label="Sort rooms"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </label>
          </div>

          {errorMessage ? (
            <div className="empty-state">
              <AlertCircle />
              <h2>A momentary pause.</h2>
              <p>{errorMessage}</p>
              <Button asChild>
                <a href="/search">
                  <RotateCcw />
                  Try again
                </a>
              </Button>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <SearchX />
              <h2>Let&apos;s find another fit.</h2>
              <p>No rooms match these dates or filters. Try widening your search.</p>
              <Button onClick={reset}>Clear filters</Button>
            </div>
          ) : (
            results.map((room) => {
              const detailParams = stay
                ? searchHref(stay, `/rooms/${room.slug}`).split("?")[1]
                : "";
              const href = `/rooms/${room.slug}${detailParams ? `?${detailParams}` : ""}`;
              const bookHref =
                availability && stay && room.availableRoomIds?.length
                  ? bookingHref(stay, room.availableRoomIds.slice(0, stay.quantity))
                  : searchHref(searchDefaults, `/rooms/${room.slug}`);
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  stay={stay}
                  currency={currency}
                  displayCurrency={display}
                  horizontal
                  href={href}
                  bookHref={bookHref}
                  policyNote={policyNote}
                  selected={selectedRoomId === room.id}
                  onSelect={() =>
                    setSelectedRoomId((current) =>
                      current === room.id ? null : room.id,
                    )
                  }
                />
              );
            })
          )}
          <p className="tiny-note">
            All prices are confirmed by our reservations team. Taxes and fees are shown at
            checkout.
          </p>
        </section>

        {showMap && (
          /* The map pane is independent of the results: it stays visible even
           * when filters or dates yield zero rooms (MR-05). It mounts — and
           * loads the Maps API — only when the guest switches to map view.
           * The pin wears the honest hotel minimum; the card beside the pin
           * mirrors exactly what the surrounding grid shows. */
          <aside className="map-pane" aria-label="Hotel location map">
            {location && (
              <SearchMap
                location={location}
                rooms={rooms}
                results={results}
                stay={stay}
                currency={currency}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
