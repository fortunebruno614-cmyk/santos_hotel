"use client";

import { useEffect, useState } from "react";
import { Cloud, MapPin, RefreshCw } from "lucide-react";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { useLocale, useT } from "@/components/hotel/locale-provider";
import {
  weatherConditionLabel,
  weatherDayLabel,
  weatherUpdatedLabel,
  type WeatherErrorPayload,
  type WeatherPayload,
} from "@/lib/weather";

const CLIENT_CACHE_MS = 5 * 60_000;
const REFRESH_MS = 15 * 60_000;

let weatherPromise: Promise<WeatherPayload | null> | null = null;
let weatherCachedAt = 0;

async function loadWeather(force = false): Promise<WeatherPayload | null> {
  if (force) {
    weatherPromise = null;
    weatherCachedAt = 0;
  }
  if (!force && weatherPromise && Date.now() - weatherCachedAt < CLIENT_CACHE_MS) {
    return weatherPromise;
  }

  weatherCachedAt = Date.now();
  weatherPromise = fetch("/api/public/weather", {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | WeatherPayload
        | WeatherErrorPayload
        | null;
      if (!response.ok || !data || data.ok !== true) return null;
      return data;
    })
    .catch(() => null)
    .then((data) => {
      if (!data) weatherPromise = null;
      return data;
    });

  return weatherPromise;
}

type WeatherStatus = "loading" | "ready" | "error";

export function WeatherWidget({
  variant,
  className,
}: {
  variant: "header" | "card";
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(force = false) {
    if (force) setRefreshing(true);
    const result = await loadWeather(force);
    setData(result);
    setStatus(result ? "ready" : "error");
    setRefreshing(false);
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await loadWeather();
      if (cancelled) return;
      setData(result);
      setStatus(result ? "ready" : "error");
    };

    void run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (variant === "header") {
    // The header is intentionally silent when the weather service is down:
    // a failed third-party service must not break the navigation.
    if (status === "error") return null;

    const city = data?.location.city || data?.location.name || "";
    const condition = data ? weatherConditionLabel(data.current.weatherCode, t) : "";
    const temperature = data ? Math.round(data.current.temperatureC) : null;
    const ariaLabel =
      data && temperature !== null
        ? t("weather.aria", { city, temperature, condition })
        : t("weather.loading");

    return (
      <div
        className={`weather-chip${status === "loading" ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <WeatherIcon
          code={data?.current.weatherCode ?? 2}
          isDay={data?.current.isDay ?? true}
          className="weather-chip-icon"
        />
        <span className="weather-chip-temp">{temperature !== null ? `${temperature}°` : "—"}</span>
        <span className="weather-chip-label">{condition || t("weather.loading")}</span>
      </div>
    );
  }

  return (
    <section className={`weather-card${className ? ` ${className}` : ""}`} aria-label={t("weather.title")}>
      <div className="weather-card-head">
        <div>
          <span className="eyebrow">{t("weather.eyebrow")}</span>
          <h2>
            <MapPin size={14} aria-hidden="true" />
            {data ? data.location.city || data.location.name : t("weather.title")}
          </h2>
        </div>
        {data && (
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="weather-attribution"
          >
            {t("weather.attribution")}
          </a>
        )}
      </div>

      {status === "loading" && (
        <div className="weather-state" role="status">
          <span className="weather-skeleton" aria-hidden="true" />
          <p>{t("weather.loading")}</p>
        </div>
      )}

      {status === "error" && (
        <div className="weather-state" role="status">
          <CloudSunFallback />
          <p>{t("weather.unavailable")}</p>
          <button type="button" className="weather-retry" onClick={() => void refresh(true)}>
            <RefreshCw size={13} aria-hidden="true" />
            {t("weather.retry")}
          </button>
        </div>
      )}

      {status === "ready" && data && (
        <>
          <div className="weather-now">
            <WeatherIcon
              code={data.current.weatherCode}
              isDay={data.current.isDay}
              className="weather-now-icon"
            />
            <div className="weather-now-temp">
              <strong>{Math.round(data.current.temperatureC)}°C</strong>
              <span>{weatherConditionLabel(data.current.weatherCode, t)}</span>
            </div>
            <div className="weather-metrics">
              <div>
                <span>{t("weather.feelsLike")}</span>
                <strong>{Math.round(data.current.feelsLikeC)}°</strong>
              </div>
              <div>
                <span>{t("weather.humidity")}</span>
                <strong>{Math.round(data.current.humidityPercent)}%</strong>
              </div>
              <div>
                <span>{t("weather.wind")}</span>
                <strong>
                  {Math.round(data.current.windKmh)} {t("weather.windUnit")}
                </strong>
              </div>
              <div>
                <span>{t("weather.precipitation")}</span>
                <strong>
                  {data.current.precipitationMm.toFixed(1)} {t("weather.rainUnit")}
                </strong>
              </div>
            </div>
          </div>

          {data.daily.length > 0 && (
            <div className="weather-forecast" aria-label={t("weather.forecast")}>
              {data.daily.slice(0, 4).map((day, index) => (
                <div className="weather-day" key={day.date}>
                  <span className="weather-day-name">
                    {weatherDayLabel(day.date, locale, t, index === 0)}
                  </span>
                  <WeatherIcon code={day.weatherCode} className="weather-day-icon" />
                  <strong>{Math.round(day.maxC)}°</strong>
                  <small>{Math.round(day.minC)}°</small>
                </div>
              ))}
            </div>
          )}

          <div className="weather-card-foot">
            <time dateTime={new Date(data.fetchedAt).toISOString()}>
              {weatherUpdatedLabel(data.fetchedAt, locale, t)}
            </time>
            {data.stale && <span>{t("weather.stale")}</span>}
            {refreshing && <RefreshCw size={11} className="animate-spin" aria-hidden="true" />}
          </div>
        </>
      )}
    </section>
  );
}

function CloudSunFallback() {
  return (
    <span className="weather-fallback-icon" aria-hidden="true">
      <Cloud size={24} />
    </span>
  );
}
