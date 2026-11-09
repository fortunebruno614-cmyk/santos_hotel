"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { googleMapsApiKey } from "@/config/maps";
import { useLocale, useT } from "@/components/hotel/locale-provider";
import type { Translator } from "@/lib/dictionaries";
import type { Aircraft, FlightCenter } from "@/lib/flights";
import { formatAltitude, formatHeading, formatSpeed } from "@/components/flights/format";

/* Minimal typings for the Google Maps surfaces this map touches. */
type GLatLng = { lat: number; lng: number };
type GBounds = {
  extend(latLng: GLatLng): void;
  isEmpty(): boolean;
};
type GMap = {
  fitBounds(bounds: GBounds, padding?: number | { top: number; right: number; bottom: number; left: number }): void;
  panTo(latLng: GLatLng): void;
  setZoom(zoom: number): void;
  addListener(event: string, handler: () => void): { remove(): void };
};
type GMarker = {
  setMap(map: GMap | null): void;
  setZIndex(zIndex: number): void;
  addListener(event: string, handler: () => void): { remove(): void };
};
type GInfoWindow = {
  setContent(content: Node | string): void;
  open(options: { map: GMap; anchor?: GMarker }): void;
  close(): void;
};
type GSize = { width: number; height: number };
type GPoint = { x: number; y: number };
type GMapsApi = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  LatLngBounds: new () => GBounds;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  InfoWindow: new () => GInfoWindow;
  Size: new (width: number, height: number) => GSize;
  Point: new (x: number, y: number) => GPoint;
};

type MapStatus = "idle" | "loading" | "ready" | "error";

let mapsPromise: Promise<GMapsApi> | null = null;

/** Load the Maps JavaScript API once per page (same pattern as SearchMap). */
function loadGoogleMapsApi(key: string): Promise<GMapsApi> {
  const w = window as unknown as { google?: { maps?: GMapsApi } };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<GMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("maps script timeout")), 15_000);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.referrerPolicy = "no-referrer-when-downgrade";
    script.onload = () => {
      window.clearTimeout(timeout);
      const loaded = (window as unknown as { google?: { maps?: GMapsApi } }).google?.maps;
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

function aircraftIcon(maps: GMapsApi, heading: number | null, selected: boolean, onGround: boolean) {
  const size = selected ? 34 : 26;
  const fill = selected ? "#b08d57" : onGround ? "#8a8f98" : "#1f3448";
  const rotation = heading !== null && Number.isFinite(heading) ? heading : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><g transform="rotate(${rotation} 12 12)"><path d="M12 2c.7 0 1.2.8 1.2 1.8v5.4l7.3 4.3v2.1l-7.3-2.2v4.1l2.3 1.7v1.7L12 20l-3.5 1.9v-1.7l2.3-1.7v-4.1l-7.3 2.2v-2.1l7.3-4.3V3.8C10.8 2.8 11.3 2 12 2z" fill="${fill}" stroke="#ffffff" stroke-width="1"/></g></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(size / 2, size / 2),
  };
}

function buildInfoNode(aircraft: Aircraft, t: Translator, locale: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "flight-info";

  const title = document.createElement("strong");
  title.textContent = aircraft.callsign ?? aircraft.icao24.toUpperCase();
  root.appendChild(title);

  const subtitle = document.createElement("span");
  subtitle.className = "flight-info-sub";
  subtitle.textContent = `${aircraft.originCountry} · ${
    aircraft.onGround ? t("flights.detail.onGround") : t("flights.detail.airborne")
  }`;
  root.appendChild(subtitle);

  const grid = document.createElement("div");
  grid.className = "flight-info-grid";
  const rows: Array<[string, string]> = [
    [t("flights.detail.altitude"), formatAltitude(aircraft.altitudeM, locale, t)],
    [t("flights.detail.speed"), formatSpeed(aircraft.velocityMps, locale, t)],
    [t("flights.detail.heading"), formatHeading(aircraft.headingDeg, locale)],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("span");
    dt.textContent = label;
    const dd = document.createElement("strong");
    dd.textContent = value;
    row.append(dt, dd);
    grid.appendChild(row);
  }
  root.appendChild(grid);

  return root;
}

export function FlightMap({
  aircraft,
  selectedId,
  onSelect,
  center,
  zoom,
  mode,
  ariaLabel,
}: {
  aircraft: Aircraft[];
  selectedId: string | null;
  onSelect: (icao24: string) => void;
  center: FlightCenter;
  zoom: number;
  mode: "region" | "search";
  ariaLabel: string;
}) {
  const mapsKey = googleMapsApiKey();
  const t = useT();
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const infoRef = useRef<GInfoWindow | null>(null);
  const markersRef = useRef<Map<string, GMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const previousModeRef = useRef(mode);
  const [maps, setMaps] = useState<GMapsApi | null>(null);
  const [status, setStatus] = useState<MapStatus>(mapsKey ? "idle" : "error");
  const centerLat = center.lat;
  const centerLng = center.lng;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapsKey) return;
    const container = containerRef.current;
    if (!container) return;
    const markers = markersRef.current;

    let cancelled = false;
    setStatus("loading");

    loadGoogleMapsApi(mapsKey)
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        const map = new api.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          clickableIcons: false,
          scaleControl: false,
          rotateControl: false,
          gestureHandling: "cooperative",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;
        infoRef.current = new api.InfoWindow();
        setMaps(api);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      infoRef.current?.close();
      infoRef.current = null;
      for (const marker of markers.values()) marker.setMap(null);
      markers.clear();
      mapRef.current = null;
    };
  }, [mapsKey, centerLat, centerLng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const info = infoRef.current;
    const markers = markersRef.current;
    if (!maps || !map || status !== "ready") return;

    for (const marker of markers.values()) marker.setMap(null);
    markers.clear();
    info?.close();

    const bounds = new maps.LatLngBounds();

    for (const item of aircraft) {
      const marker = new maps.Marker({
        map,
        position: { lat: item.latitude, lng: item.longitude },
        title: item.callsign ?? item.icao24.toUpperCase(),
        zIndex: item.icao24 === selectedId ? 999 : 1,
        icon: aircraftIcon(maps, item.headingDeg, item.icao24 === selectedId, item.onGround),
      });
      marker.addListener("click", () => {
        onSelectRef.current(item.icao24);
        info?.setContent(buildInfoNode(item, t, locale));
        info?.open({ map, anchor: marker });
      });
      markers.set(item.icao24, marker);
      bounds.extend({ lat: item.latitude, lng: item.longitude });
    }

    if (selectedId) {
      const selected = aircraft.find((item) => item.icao24 === selectedId);
      const marker = markers.get(selectedId);
      if (selected && marker) {
        info?.setContent(buildInfoNode(selected, t, locale));
        info?.open({ map, anchor: marker });
        map.panTo({ lat: selected.latitude, lng: selected.longitude });
      }
    } else if (mode === "search" && aircraft.length > 0) {
      if (aircraft.length === 1) {
        map.panTo({ lat: aircraft[0].latitude, lng: aircraft[0].longitude });
        map.setZoom(8);
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 60);
      }
    } else if (mode === "region" && previousModeRef.current === "search") {
      // Returning from a global search restores the hotel's regional view.
      map.panTo({ lat: centerLat, lng: centerLng });
      map.setZoom(zoom);
    }

    previousModeRef.current = mode;

    return () => {
      for (const marker of markers.values()) marker.setMap(null);
      markers.clear();
      info?.close();
    };
  }, [maps, status, aircraft, selectedId, mode, t, locale, centerLat, centerLng, zoom]);

  if (!mapsKey) {
    return (
      <div className="flight-map-fallback" role="status">
        <strong>{t("flights.map.unavailableTitle")}</strong>
        <p>{t("flights.map.unavailableBody")}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flight-map-fallback" role="status">
        <strong>{t("flights.map.errorTitle")}</strong>
        <p>{t("flights.map.errorBody")}</p>
      </div>
    );
  }

  return (
    <div className="flight-map-shell">
      <div
        ref={containerRef}
        className="flight-map-canvas"
        role="application"
        aria-label={ariaLabel}
      />
      {status !== "ready" && (
        <div className="flight-map-loading" role="status">
          <Loader2 className="animate-spin" />
          <span>{t("flights.map.loading")}</span>
        </div>
      )}
      {status === "ready" && aircraft.length === 0 && (
        <div className="flight-map-empty" role="status">
          {t("flights.map.noAircraft")}
        </div>
      )}
      <div className="flight-map-legend" aria-hidden="true">
        <span className="flight-map-legend-dot" />
        {t("flights.legend")}
      </div>
    </div>
  );
}
