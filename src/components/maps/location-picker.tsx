"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { googleMapsApiKey } from "@/config/maps";

/** Google Maps LatLng instances expose lat()/lng() methods, not properties. */
type MapsLatLng = { lat(): number; lng(): number };
/** Plain literals are accepted wherever Maps expects a LatLng. */
type MapsLatLngLike = { lat: number; lng: number };
type MapsMap = {
  setCenter(value: MapsLatLngLike): void;
  setZoom(value: number): void;
  addListener(event: string, handler: (event: { latLng?: MapsLatLngLike }) => void): void;
};
type MapsMarker = {
  setPosition(value: MapsLatLngLike): void;
  getPosition(): MapsLatLngLike | null;
  addListener(event: string, handler: () => void): void;
};
type MapsGeocoder = {
  geocode(
    request: { address: string },
    callback: (
      results: Array<{ geometry: { location: MapsLatLng }; formatted_address: string }> | null,
      status: string,
    ) => void,
  ): void;
};
type MapsNamespace = {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapsMap;
  Marker: new (options: Record<string, unknown>) => MapsMarker;
  LatLng: new (lat: number, lng: number) => MapsLatLng;
  Geocoder: new () => MapsGeocoder;
};

function readCoordinates(point: MapsLatLngLike | MapsLatLng) {
  return typeof point.lat === "function"
    ? { lat: point.lat(), lng: (point as MapsLatLng).lng() }
    : { lat: point.lat, lng: (point as MapsLatLngLike).lng };
}

let mapsPromise: Promise<MapsNamespace> | null = null;

function loadMaps(key: string): Promise<MapsNamespace> {
  const w = window as unknown as { google?: { maps?: MapsNamespace } };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("maps timeout")), 15_000);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      const loaded = (window as unknown as { google?: { maps?: MapsNamespace } }).google?.maps;
      if (loaded) resolve(loaded);
      else reject(new Error("maps missing"));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("maps failed"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/**
 * Interactive location picker: click the map, search an address, or type the
 * pair manually. Coordinates are always a pair; clearing either clears both.
 * When Google Maps is unavailable the manual inputs keep working — the hotel
 * is never blocked on the map provider.
 */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
  demo = false,
}: {
  latitude: string;
  longitude: string;
  onChange: (next: { latitude: string; longitude: string }) => void;
  demo?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<MapsMap | null>(null);
  const markerRef = useRef<MapsMarker | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const key = googleMapsApiKey();

  useEffect(() => {
    if (!key || !mapRef.current) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    loadMaps(key)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const lat = Number(latitude);
        const lng = Number(longitude);
        const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && latitude !== "" && longitude !== "";
        const center = hasPoint ? { lat, lng } : { lat: 6.4541, lng: 3.3947 };
        const map = new maps.Map(mapRef.current, {
          center,
          zoom: hasPoint ? 15 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstance.current = map;
        const marker = new maps.Marker({
          map,
          position: center,
          draggable: true,
          visible: hasPoint,
        });
        markerRef.current = marker;
        const setPoint = (point: MapsLatLngLike | MapsLatLng) => {
          const coordinates = readCoordinates(point);
          marker.setPosition(coordinates);
          onChange({
            latitude: coordinates.lat.toFixed(6),
            longitude: coordinates.lng.toFixed(6),
          });
        };
        map.addListener("click", (event) => {
          if (event.latLng) setPoint(event.latLng);
        });
        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (position) setPoint(position);
        });
        markerRef.current = marker;
        setStatus("ready");
      })
      .catch(() => setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
    // The map is initialized once; later coordinate edits are reflected below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Keep the marker in sync when the coordinates are edited manually.
  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!mapInstance.current || !markerRef.current) return;
    if (latitude === "" || longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }
    const point = { lat, lng };
    markerRef.current.setPosition(point);
    mapInstance.current.setCenter(point);
  }, [latitude, longitude]);

  const search = () => {
    const maps = (window as unknown as { google?: { maps?: MapsNamespace } }).google?.maps;
    if (!query.trim() || !maps) return;
    setMessage("Searching…");
    new maps.Geocoder().geocode({ address: query.trim() }, (results, resultStatus) => {
      if (resultStatus === "REQUEST_DENIED") {
        setMessage(
          "Address search is not enabled for this Maps key. Click the map or enter coordinates manually.",
        );
        return;
      }
      if (resultStatus !== "OK" || !results?.[0]) {
        setMessage("No match for that address.");
        return;
      }
      const location = readCoordinates(results[0].geometry.location);
      onChange({
        latitude: location.lat.toFixed(6),
        longitude: location.lng.toFixed(6),
      });
      setMessage(results[0].formatted_address);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">
            {demo ? "Map latitude (demo)" : "Map latitude"}
          </span>
          <input
            className="border px-2 py-1 rounded-md w-36"
            value={latitude}
            placeholder="6.454100"
            inputMode="decimal"
            onChange={(event) =>
              onChange({
                latitude: event.target.value,
                longitude: event.target.value.trim() === "" ? "" : longitude,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">
            {demo ? "Map longitude (demo)" : "Map longitude"}
          </span>
          <input
            className="border px-2 py-1 rounded-md w-36"
            value={longitude}
            placeholder="3.394700"
            inputMode="decimal"
            onChange={(event) =>
              onChange({
                latitude: event.target.value.trim() === "" ? "" : latitude,
                longitude: event.target.value,
              })
            }
          />
        </label>
        {(latitude || longitude) && (
          <button
            type="button"
            className="border px-2 py-1 rounded-md text-xs"
            onClick={() => onChange({ latitude: "", longitude: "" })}
          >
            Clear
          </button>
        )}
      </div>

      {key ? (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the building address…"
              className="border px-2 py-1 rounded-md text-sm flex-1 min-w-48"
            />
            <button
              type="button"
              onClick={search}
              className="border px-3 py-1 rounded-md text-sm inline-flex items-center gap-1"
            >
              <Search size={14} /> Find
            </button>
          </div>
          <div
            ref={mapRef}
            className="h-64 w-full rounded-md border bg-zinc-100"
            aria-label="Hotel location map"
          />
          <p className="text-xs text-zinc-500">
            {status === "loading"
              ? "Loading map…"
              : status === "ready"
                ? "Click the map (or drag the pin) to set the exact building entrance."
                : "Map unavailable on this deploy — enter coordinates manually."}
          </p>
          {message && <p className="text-xs text-zinc-500">{message}</p>}
        </>
      ) : (
        <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <MapPin size={14} /> Map preview is disabled (no Google Maps key). Coordinates still
          save and drive the public map when a key is configured.
        </p>
      )}
    </div>
  );
}
