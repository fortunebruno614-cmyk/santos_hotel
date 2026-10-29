"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasCoordinates, mapZoomForCoordinates, type HotelLocation } from "@/lib/hotel";
import { googleMapsApiKey } from "@/config/maps";

/**
 * Public room map (MR-01..MR-04): a single marker for the one hotel, with an
 * accessible info card (name, address, link to the hotel page).
 *
 * The Maps JavaScript API is loaded on demand with a script tag (no npm
 * dependency); until it resolves the pane shows a skeleton the size of the
 * final map, and a failure lands on an error state distinct from the
 * "Map location unavailable" state used when no verified coordinates exist
 * (MR-06). The API key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and is
 * never logged. Zoom opens at — and is capped at — the precision the stored
 * coordinates support (MR-04), so the map never implies more accuracy than
 * the operator verified.
 */

/* Minimal typings for the three Maps API surfaces we touch. */
type MapsLatLngLiteral = { lat: number; lng: number };

type MapsMarker = {
  addListener(event: string, handler: () => void): void;
};

type MapsMap = {
  addListener(event: string, handler: () => void): void;
};

type MapsNamespace = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapsMap;
  Marker: new (opts: Record<string, unknown>) => MapsMarker;
  LatLng: new (lat: number, lng: number) => MapsLatLngLiteral;
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

export function HotelMap({
  location,
  selectedRoomName,
}: {
  location: HotelLocation;
  selectedRoomName?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The key is a build-time env var — read once (never logged).
  const mapsKey = googleMapsApiKey();
  // Stable reference to the coordinate pair (null when not verified).
  const coordinates = useMemo(
    () =>
      hasCoordinates(location)
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
    [location],
  );
  // No key configured → straight to the error state (Listing hides the toggle
  // without a key, so this is only a defensive default).
  const [loadState, setLoadState] = useState<LoadState>(() =>
    coordinates && !mapsKey ? "error" : "idle",
  );
  const [cardOpen, setCardOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // "Map location unavailable" — nothing to load; a missing key already
    // resolved to the error state above, so neither reaches the loader.
    if (!coordinates || !mapsKey) return;
    let cancelled = false;

    loadMapsApi(mapsKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
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
        const marker = new maps.Marker({ position: center, map, title: location.name });
        marker.addListener("click", () => setCardOpen(true));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [coordinates, mapsKey, location.name]);

  // Move focus into the card when it opens from the keyboard.
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

  return (
    <div className="map-pane-inner">
      {coordinates ? (
        <>
          <div
            ref={containerRef}
            className="map-canvas"
            role="application"
            aria-label={`Map showing the location of ${location.name}`}
          />
          {loadState === "idle" && (
            /* Skeleton overlays the canvas at the final pane size, so the map
             * initializes on a visible, correctly-sized container (no jump). */
            <div className="map-skeleton" aria-hidden="true" />
          )}
          {loadState === "idle" && (
            <p className="map-status" role="status">Loading map…</p>
          )}
          {loadState === "error" && (
            <div className="map-error" role="status">
              <p className="map-state-title">The map could not be loaded.</p>
              <p>
                The location below is still available, and the room list and
                booking flow are unaffected.
              </p>
              {address && <p className="map-address">{address}</p>}
            </div>
          )}
          {/* Keyboard/touch path to the same info card the marker opens. */}
          {loadState === "ready" && (
            <button
              type="button"
              className="map-info-trigger"
              aria-expanded={cardOpen}
              onClick={() => setCardOpen((open) => !open)}
            >
              {cardOpen ? "Hide hotel details" : "Show hotel details"}
            </button>
          )}
          {loadState === "ready" && cardOpen && (
            <div className="map-card" role="dialog" aria-modal="false" aria-label={`${location.name} details`}>
              <div className="map-card-head">
                <strong>{location.name}</strong>
                <button
                  ref={closeRef}
                  type="button"
                  className="map-card-close"
                  aria-label="Close hotel details"
                  onClick={() => setCardOpen(false)}
                >
                  ×
                </button>
              </div>
              {address && <p className="map-address">{address}</p>}
              {selectedRoomName && (
                <p className="map-card-selection">
                  Selected room: {selectedRoomName}
                </p>
              )}
              <a className="text-link" href="/hotel">
                View hotel page
              </a>
            </div>
          )}
        </>
      ) : (
        /* MR-06: distinct state when no verified coordinates are stored. */
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
