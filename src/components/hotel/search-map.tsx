"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasCoordinates, mapZoomForCoordinates, searchHref, fallbackImageForSlug, formatMoney, nightsBetween, type HotelLocation, type ListingRoom, type StayQuery } from "@/lib/hotel";
import { googleMapsApiKey, isDemoMapLocation } from "@/config/maps";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";

/**
 * Search-results map: the fazwaz-style price pin. One marker sits on the
 * hotel's verified coordinates and wears the lowest nightly rate as a badge
 * ("From ₦45,000"). Activating the pin opens a card that lists the current
 * room results with their per-night prices and available room counts, each
 * row linking through to the room details with the stay parameters intact.
 *
 * The Maps JavaScript API is loaded on demand with a script tag (no npm
 * dependency); the pin itself is a plain DOM overlay (OverlayView), so the
 * badge is real text, styled with our own CSS, and keyboard-activatable.
 * Server-side quote, availability and pricing authority is untouched: the
 * map only ever presents numbers it was handed.
 */

/* Minimal typings for the Maps API surfaces we touch. */
type MapsLatLngLiteral = { lat: number; lng: number };

type MapsMap = {
  addListener(event: string, handler: () => void): void;
};

type MapsProjection = {
  fromLatLngToDivPixel(latLng: MapsLatLngLiteral): { x: number; y: number } | null;
};

type MapsPanes = { overlayMouseTarget: HTMLElement };

/** The OverlayView surface a DOM overlay actually needs. */
type MapsOverlayBase = {
  setMap(map: MapsMap | null): void;
  getProjection(): MapsProjection | null;
  getPanes(): MapsPanes | null;
};

type MapsNamespace = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapsMap;
  LatLng: new (lat: number, lng: number) => MapsLatLngLiteral;
  OverlayView: new () => MapsOverlayBase;
};

type LoadState = "idle" | "ready" | "error";

let mapsPromise: Promise<MapsNamespace> | null = null;

/** Load the Maps JS API once per page; rejects on script error or timeout. */
function loadMapsApi(key: string): Promise<MapsNamespace> {
  const w = window as unknown as { google?: { maps?: MapsNamespace } };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<MapsNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(
      () => reject(new Error("maps script timeout")),
      15_000,
    );
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.referrerPolicy = "no-referrer-when-downgrade";
    script.onload = () => {
      window.clearTimeout(timeout);
      const loaded = (window as unknown as { google?: { maps?: MapsNamespace } }).google?.maps;
      if (loaded) resolve(loaded);
      else reject(new Error("maps api missing after load"));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("maps script failed"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/**
 * A DOM element pinned to a geographic position. The chip is created once
 * and repositioned by the API on every pan/zoom via draw(); its price text
 * is later updated in place when the (filtered) cheapest rate changes.
 */
function createPricePinOverlay(
  maps: MapsNamespace,
  position: { lat: number; lng: number },
  chip: HTMLElement,
) {
  const OverlayBase = maps.OverlayView as unknown as { new (): MapsOverlayBase };
  class PricePin extends OverlayBase {
    position: MapsLatLngLiteral;
    private el: HTMLElement;

    constructor() {
      super();
      this.position = new maps.LatLng(position.lat, position.lng);
      this.el = chip;
    }

    onAdd() {
      const panes = this.getPanes();
      if (panes) panes.overlayMouseTarget.appendChild(this.el);
    }

    draw() {
      const projection = this.getProjection();
      const point = projection?.fromLatLngToDivPixel(this.position);
      if (!point || !this.el) return;
      this.el.style.left = `${point.x}px`;
      this.el.style.top = `${point.y}px`;
    }

    onRemove() {
      this.el.remove();
    }
  }
  return new PricePin();
}

export function SearchMap({
  location,
  rooms,
  results,
  stay,
  currency,
}: {
  location: HotelLocation;
  /** The full room set: the pin's "From" price is the honest hotel minimum. */
  rooms: ListingRoom[];
  /** The currently filtered results, as they appear in the grid beside it. */
  results: ListingRoom[];
  stay?: StayQuery;
  currency: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsKey = googleMapsApiKey();
  const demoLocation = isDemoMapLocation();
  const display = useDisplayCurrency();

  const coordinates = useMemo(
    () =>
      hasCoordinates(location)
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
    [location],
  );

  const cheapestOf = (list: ListingRoom[]) => {
    let lowest = Infinity;
    for (const room of list) {
      const nightly = Number(room.price?.nightlyRate ?? room.basePrice);
      if (Number.isFinite(nightly) && nightly < lowest) lowest = nightly;
    }
    return lowest;
  };
  const fromPrice = useMemo(() => cheapestOf(rooms), [rooms]);
  const pinLabel = `From ${formatMoney(fromPrice, currency, display)}`;

  const [loadState, setLoadState] = useState<LoadState>(() =>
    coordinates && !mapsKey ? "error" : "idle",
  );
  const [cardOpen, setCardOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // The chip DOM lives inside the overlay; its price text updates in place.
  const pinPriceRef = useRef<HTMLSpanElement | null>(null);

  // Keep the badge truthful when filters or dates change the cheapest rate.
  useEffect(() => {
    if (pinPriceRef.current) pinPriceRef.current.textContent = pinLabel;
  }, [pinLabel]);

  useEffect(() => {
    if (!coordinates || !mapsKey) return;
    let cancelled = false;

    loadMapsApi(mapsKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;

        const chip = document.createElement("div");
        chip.className = "map-pin-wrap";
        chip.style.position = "absolute";
        chip.style.transform = "translate(-50%, -100%)";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "map-price-pin";
        button.title = location.name;
        button.setAttribute("aria-haspopup", "dialog");
        const priceText = document.createElement("span");
        priceText.className = "map-price-pin-label";
        priceText.textContent = pinLabel;
        pinPriceRef.current = priceText;
        button.appendChild(priceText);
        // The pin is a real button, so it is keyboard-focusable inside the map.
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          setCardOpen((open) => !open);
        });
        // Keep map panning from treating the chip as map surface.
        button.addEventListener("mousedown", (event) => event.stopPropagation());
        chip.appendChild(button);

        const zoom = mapZoomForCoordinates(coordinates.latitude, coordinates.longitude);
        const center = { lat: coordinates.latitude, lng: coordinates.longitude };
        const map = new maps.Map(containerRef.current, {
          center,
          zoom,
          // Never zoom past the verified precision (MR-04).
          maxZoom: zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        const overlay = createPricePinOverlay(maps, center, chip);
        overlay.setMap(map);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [coordinates, mapsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move focus into the card when it opens.
  useEffect(() => {
    if (cardOpen) closeRef.current?.focus();
  }, [cardOpen]);

  // Escape dismisses the card (WCAG 2.2 AA operability).
  useEffect(() => {
    if (!cardOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCardOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardOpen]);

  const address = location.address;
  const nights = stay ? nightsBetween(stay.checkIn, stay.checkOut) : 0;

  return (
    <div className="map-pane-inner">
      {coordinates ? (
        <>
          {demoLocation && (
            <p className="map-demo-notice" role="note">
              Demo map location · not the hotel&apos;s verified address
            </p>
          )}
          <div
            ref={containerRef}
            className="map-canvas"
            role="application"
            aria-label={`Map showing the location of ${location.name}`}
          />
          {loadState === "idle" && (
            <div className="map-skeleton" aria-hidden="true" />
          )}
          {loadState === "idle" && (
            <p className="map-status" role="status">Loading map…</p>
          )}
          {loadState === "error" && (
            <div className="map-error" role="status">
              <p className="map-state-title">The map could not be loaded.</p>
              <p>
                The room list and booking flow are unaffected — every room is
                still reachable beside this pane.
              </p>
              {address && <p className="map-address">{address}</p>}
            </div>
          )}

          {loadState === "ready" && (
            <button
              type="button"
              className="map-info-trigger"
              aria-expanded={cardOpen}
              onClick={() => setCardOpen((open) => !open)}
            >
              {cardOpen ? "Hide prices" : `Show prices ${pinLabel}`}
            </button>
          )}

          {loadState === "ready" && cardOpen && (
            <div
              className="map-card"
              role="dialog"
              aria-modal="false"
              aria-label={`${location.name} prices and availability`}
            >
              <div className="map-card-head">
                <strong>{location.name}</strong>
                <button
                  ref={closeRef}
                  type="button"
                  className="map-card-close"
                  aria-label="Close prices and availability"
                  onClick={() => setCardOpen(false)}
                >
                  ×
                </button>
              </div>
              {address && <p className="map-address">{address}</p>}
              <p className="map-card-from">
                Nightly rates from{" "}
                <strong>{formatMoney(fromPrice, currency, display)}</strong>
                {stay && (
                  <span>
                    {" "}· {stay.checkIn} → {stay.checkOut} ({nights}{" "}
                    {nights === 1 ? "night" : "nights"})
                  </span>
                )}
              </p>

              {results.length === 0 ? (
                <p className="map-card-empty">
                  No rooms match your current filters or dates. Widen the
                  search to see what&apos;s available.
                </p>
              ) : (
                <ul className="map-room-list">
                  {results.map((room) => {
                    const href = stay
                      ? roomHrefWithStay(room.slug, stay)
                      : `/rooms/${room.slug}`;
                    const nightly = room.price?.nightlyRate ?? room.basePrice;
                    return (
                      <li key={room.id}>
                        <a href={href} className="map-room-row">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="map-room-thumb"
                            src={room.images[0] ?? fallbackImageForSlug(room.slug)}
                            alt=""
                            width={72}
                            height={54}
                            loading="lazy"
                          />
                          <span className="map-room-info">
                            <span className="map-room-name">{room.name}</span>
                            <span className="map-room-meta">
                              {room.maxAdults} guests · {room.bed}
                            </span>
                            {room.availableCount !== undefined && (
                              <span className="map-room-avail">
                                {room.availableCount}{" "}
                                {room.availableCount === 1 ? "room" : "rooms"} available
                              </span>
                            )}
                          </span>
                          <span className="map-room-price">
                            <strong>{formatMoney(nightly, currency, display)}</strong>
                            <span>per night</span>
                            {stay && room.price?.stayTotal && (
                              <span className="map-room-total">
                                {formatMoney(room.price.stayTotal, currency, display)} for {nights}{" "}
                                {nights === 1 ? "night" : "nights"}
                              </span>
                            )}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="map-unavailable" role="status">
          <p className="map-state-title">Map location unavailable</p>
          <p>
            The hotel&apos;s verified map position has not been set yet. The
            room list and booking flow are unaffected.
          </p>
          {address && <p className="map-address">{address}</p>}
        </div>
      )}
    </div>
  );
}

/** Room details link that keeps the current stay parameters in the URL. */
function roomHrefWithStay(slug: string, stay: StayQuery): string {
  const query = searchHref(stay, `/rooms/${slug}`).split("?")[1];
  return query ? `/rooms/${slug}?${query}` : `/rooms/${slug}`;
}
