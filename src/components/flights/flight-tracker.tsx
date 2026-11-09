"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Navigation, Plane, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlightMap } from "@/components/flights/flight-map";
import {
  EMPTY_VALUE,
  formatAltitude,
  formatClock,
  formatFlightTime,
  formatHeading,
  formatNumber,
  formatSpeed,
  formatVerticalRate,
  positionSourceLabel,
} from "@/components/flights/format";
import { useLocale, useT } from "@/components/hotel/locale-provider";
import type { Dictionary } from "@/lib/dictionaries";
import {
  isValidFlightQuery,
  mpsToKmh,
  normalizeFlightQuery,
  type Aircraft,
  type FlightBbox,
  type FlightCenter,
  type FlightsApiError,
  type FlightsApiResponse,
} from "@/lib/flights";

const ERROR_KEYS: Record<string, keyof Dictionary> = {
  not_configured: "flights.error.not_configured",
  invalid_query: "flights.error.invalid_query",
  rate_limited: "flights.error.rate_limited",
  upstream: "flights.error.upstream",
  network: "flights.error.network",
};

const REFRESH_MS = 120_000;
const REGIONAL_LIMIT = 250;
const SEARCH_LIMIT = 100;
const WORLD_CENTER = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;

function bboxQuery(bbox: FlightBbox): string {
  return [bbox.lamin, bbox.lomin, bbox.lamax, bbox.lomax]
    .map((value) => value.toFixed(6))
    .join(",");
}

export function FlightTracker({
  initialCenter,
  initialBbox,
  initialZoom,
  hotelName,
}: {
  initialCenter: FlightCenter;
  initialBbox: FlightBbox;
  initialZoom: number;
  hotelName: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<keyof Dictionary | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scope, setScope] = useState<"world" | "hotel">("world");

  const requestCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const bbox = useMemo(() => bboxQuery(initialBbox), [initialBbox]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const requestId = ++requestCounter.current;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeQuery) params.set("callsign", activeQuery);
      else if (scope === "world") params.set("scope", "world");
      else params.set("bbox", bbox);
      params.set("limit", String(activeQuery ? SEARCH_LIMIT : REGIONAL_LIMIT));

      const response = await fetch(`/api/public/flights?${params.toString()}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as
        | FlightsApiResponse
        | FlightsApiError
        | null;

      if (requestId !== requestCounter.current) return;

      if (!response.ok || !data || !data.ok) {
        setErrorCode(data && "error" in data ? data.error : "generic");
        setHasLoaded(true);
        return;
      }

      setAircraft(data.aircraft);
      setLastUpdated(data.fetchedAt);
      setCached(data.cached);
      setErrorCode(null);
      setHasLoaded(true);
      setSelectedId((current) =>
        current && data.aircraft.some((item) => item.icao24 === current) ? current : null,
      );
    } catch {
      if (controller.signal.aborted) return;
      if (requestId === requestCounter.current) {
        setErrorCode("network");
        setHasLoaded(true);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [activeQuery, bbox, scope]);

  useEffect(() => {
    // Defer the first request one tick so the fetch's setState calls happen
    // after the effect body, not during render-adjacent synchronous work.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    return () => {
      requestCounter.current += 1;
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      if (document.visibilityState === "visible" && !abortRef.current) void load();
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [autoRefresh, load]);

  const selected = useMemo(
    () => aircraft.find((item) => item.icao24 === selectedId) ?? null,
    [aircraft, selectedId],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeFlightQuery(search);
    if (!isValidFlightQuery(normalized)) {
      setSearchError("flights.error.invalid_query");
      return;
    }
    setSearchError(null);
    setSelectedId(null);
    setSearch(normalized);
    setActiveQuery(normalized);
  }

  function clearSearch() {
    setSearch("");
    setActiveQuery(null);
    setSearchError(null);
    setSelectedId(null);
  }

  function chooseScope(next: "world" | "hotel") {
    if (next === scope) return;
    setScope(next);
    setSearchError(null);
    setSelectedId(null);
  }

  const mapCenter = activeQuery || scope === "hotel" ? initialCenter : WORLD_CENTER;
  const mapZoom = activeQuery || scope === "hotel" ? initialZoom : WORLD_ZOOM;
  const mapAria = t(
    activeQuery || scope === "hotel" ? "flights.map.aria" : "flights.map.ariaWorld",
    { hotel: hotelName },
  );
  const listHeading = activeQuery
    ? t("flights.searchResults", { query: activeQuery })
    : scope === "world"
      ? t("flights.worldwide")
      : t("flights.regional", { hotel: hotelName });

  const errorKey = searchError ?? (errorCode ? ERROR_KEYS[errorCode] ?? "flights.error.generic" : null);
  const isLoading = loading || !hasLoaded;
  const statusLabel = isLoading
    ? loading && hasLoaded
      ? t("flights.refreshing")
      : t("flights.loading")
    : errorCode
      ? t("flights.errorShort")
      : cached && hasLoaded
        ? t("flights.cached")
        : t("flights.live");
  const countLabel =
    aircraft.length === 1 ? t("flights.countOne") : t("flights.count", { count: aircraft.length });

  return (
    <section className="flight-tracker">
      <form className="flight-search" onSubmit={submit} role="search">
        <label htmlFor="flight-search-input" className="visually-hidden">
          {t("flights.search.label")}
        </label>
        <div className="flight-search-row">
          <Search size={17} aria-hidden="true" />
          <input
            id="flight-search-input"
            name="flight"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (searchError) setSearchError(null);
            }}
            placeholder={t("flights.search.placeholder")}
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            aria-describedby="flight-search-hint"
          />
          {activeQuery && (
            <button
              type="button"
              className="flight-search-clear"
              onClick={clearSearch}
              aria-label={t("flights.search.clear")}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <Button type="submit" className="flight-search-submit">
            <Plane />
            {t("flights.search.button")}
          </Button>
        </div>
        <p id="flight-search-hint" className="flight-search-hint">
          {activeQuery ? t("flights.search.globalHint") : t("flights.search.hint")}
        </p>
      </form>

      <div className="flight-toolbar">
        <div className="flight-status" role="status" aria-live="polite">
          <span
            className={`flight-status-dot${isLoading ? " is-loading" : ""}${errorCode ? " is-error" : ""}`}
            aria-hidden="true"
          />
          <strong>{statusLabel}</strong>
          {lastUpdated !== null && (
            <span className="flight-updated">{t("flights.updated", { time: formatClock(lastUpdated, locale) })}</span>
          )}
          {cached && hasLoaded && !loading && (
            <span className="flight-cached">{t("flights.cached")}</span>
          )}
        </div>
        <div className="flight-actions">
          <div className="flight-scope" role="group" aria-label={t("flights.scope.label")}>
            <button
              type="button"
              aria-pressed={scope === "world"}
              onClick={() => chooseScope("world")}
            >
              {t("flights.scope.world")}
            </button>
            <button
              type="button"
              aria-pressed={scope === "hotel"}
              onClick={() => chooseScope("hotel")}
            >
              {t("flights.scope.hotel")}
            </button>
          </div>
          <label className="flight-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            <span>{t("flights.autoRefresh")}</span>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t("flights.refresh")}
          </Button>
        </div>
      </div>

      {errorKey && (
        <p className="form-error flight-error" role="alert">
          {t(errorKey)}
        </p>
      )}

      <div className="flight-layout">
        <div className="flight-map-column">
          <FlightMap
            aircraft={aircraft}
            selectedId={selectedId}
            onSelect={setSelectedId}
            center={mapCenter}
            zoom={mapZoom}
            mode={activeQuery ? "search" : "region"}
            ariaLabel={mapAria}
          />
        </div>

        <aside className="flight-sidebar">
          <div className="flight-sidebar-head">
            <h2>{listHeading}</h2>
            <span className="subtle-badge">{hasLoaded ? countLabel : "—"}</span>
          </div>

          {selected && (
            <div className="flight-details" aria-live="polite">
              <div className="flight-details-head">
                <div>
                  <span className="flight-details-callsign">
                    {selected.callsign ?? selected.icao24.toUpperCase()}
                  </span>
                  <small>{selected.originCountry}</small>
                </div>
                <button
                  type="button"
                  className="flight-details-close"
                  onClick={() => setSelectedId(null)}
                  aria-label={t("flights.detail.close")}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>

              <dl className="flight-detail-grid">
                <div>
                  <dt>{t("flights.detail.altitude")}</dt>
                  <dd>{formatAltitude(selected.altitudeM, locale, t)}</dd>
                </div>
                <div>
                  <dt>{t("flights.detail.speed")}</dt>
                  <dd>{formatSpeed(selected.velocityMps, locale, t)}</dd>
                </div>
                <div>
                  <dt>{t("flights.detail.heading")}</dt>
                  <dd className="flight-heading-value">
                    <span
                      className="flight-heading-arrow"
                      style={{ transform: `rotate(${selected.headingDeg ?? 0}deg)` }}
                      aria-hidden="true"
                    >
                      <Navigation size={11} />
                    </span>
                    {formatHeading(selected.headingDeg, locale)}
                  </dd>
                </div>
                <div>
                  <dt>{t("flights.detail.verticalRate")}</dt>
                  <dd>{formatVerticalRate(selected.verticalRateMps, locale, t)}</dd>
                </div>
                <div>
                  <dt>{t("flights.detail.status")}</dt>
                  <dd>
                    {selected.onGround
                      ? t("flights.detail.onGround")
                      : t("flights.detail.airborne")}
                  </dd>
                </div>
                <div>
                  <dt>{t("flights.detail.lastContact")}</dt>
                  <dd>{formatFlightTime(selected.lastContact, locale)}</dd>
                </div>
              </dl>

              <div className="flight-detail-meta">
                <span>
                  {t("flights.detail.icao24")}: {selected.icao24.toUpperCase()}
                </span>
                {selected.squawk && (
                  <span>
                    {t("flights.detail.squawk")}: {selected.squawk}
                  </span>
                )}
                <span>
                  {t("flights.detail.positionSource")}:{" "}
                  {positionSourceLabel(selected.positionSource, t)}
                </span>
              </div>
            </div>
          )}

          {!hasLoaded && !errorKey ? (
            <div className="flight-empty" role="status">
              <Loader2 className="animate-spin" aria-hidden="true" />
              <p>{t("flights.loading")}</p>
            </div>
          ) : aircraft.length === 0 ? (
            <div className="flight-empty">
              <Plane size={22} aria-hidden="true" />
              <p>
                {activeQuery
                  ? t("flights.list.emptySearch", { query: activeQuery })
                  : scope === "world"
                    ? t("flights.list.emptyWorld")
                    : t("flights.list.empty", { hotel: hotelName })}
              </p>
            </div>
          ) : (
            <ul className="flight-list">
              {aircraft.map((item) => {
                const isSelected = item.icao24 === selectedId;
                return (
                  <li key={item.icao24}>
                    <button
                      type="button"
                      className={`flight-row${isSelected ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(item.icao24)}
                      aria-pressed={isSelected}
                    >
                      <span className="flight-row-main">
                        <strong>{item.callsign ?? item.icao24.toUpperCase()}</strong>
                        <small>{item.originCountry}</small>
                      </span>
                      <span className="flight-row-metrics">
                        <span>
                          {item.altitudeM !== null ? (
                            <>
                              {formatNumber(item.altitudeM, locale)} {t("flights.unit.meters")}
                            </>
                          ) : (
                            EMPTY_VALUE
                          )}
                        </span>
                        <span>
                          {item.velocityMps !== null ? (
                            <>
                              {formatNumber(mpsToKmh(item.velocityMps), locale)} {t("flights.unit.kmh")}
                            </>
                          ) : (
                            EMPTY_VALUE
                          )}
                        </span>
                        <span>
                          {item.headingDeg !== null
                            ? `${formatNumber(item.headingDeg, locale)}°`
                            : EMPTY_VALUE}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <p className="flight-attribution">
        {t("flights.attribution")}{" "}
        <a href="https://www.opensky-network.org" target="_blank" rel="noopener noreferrer">
          OpenSky Network
        </a>
      </p>
    </section>
  );
}
