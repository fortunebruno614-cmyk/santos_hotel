import { WEATHER_CACHE_TTL_SECONDS, WEATHER_TIMEOUT_MS } from "@/config/weather";
import type {
  WeatherCurrent,
  WeatherDay,
  WeatherLocation,
  WeatherPayload,
} from "@/lib/weather";

/**
 * Open-Meteo client with a shared in-memory cache.
 *
 * The API is keyless, but the cache still matters: every page view would
 * otherwise hit a third-party service. Cache failures fall back to the last
 * successful payload (marked `stale`) so the widget degrades gracefully.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ATTRIBUTION = "Weather data by Open-Meteo";

export class WeatherError extends Error {
  constructor(message = "weather_unavailable") {
    super(message);
    this.name = "WeatherError";
  }
}

type CacheEntry = { expiresAt: number; payload: WeatherPayload };

type WeatherStore = {
  cache: Map<string, CacheEntry>;
  inflight: Map<string, Promise<WeatherPayload>>;
};

const globalStore = globalThis as unknown as { __santoWeather?: WeatherStore };
const store: WeatherStore =
  globalStore.__santoWeather ??
  (globalStore.__santoWeather = {
    cache: new Map(),
    inflight: new Map(),
  });

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function parseOpenMeteo(payload: unknown, location: WeatherLocation): WeatherPayload {
  const root = record(payload);
  const current = record(root?.current);
  if (!root || !current) throw new WeatherError("invalid_weather_response");

  const temperatureC = finite(current.temperature_2m);
  if (temperatureC === null) throw new WeatherError("invalid_weather_response");

  const currentWeather: WeatherCurrent = {
    time: typeof current.time === "string" ? current.time : new Date().toISOString(),
    temperatureC,
    feelsLikeC: finite(current.apparent_temperature) ?? temperatureC,
    humidityPercent: finite(current.relative_humidity_2m) ?? 0,
    precipitationMm: finite(current.precipitation) ?? 0,
    weatherCode: finite(current.weather_code) ?? -1,
    windKmh: finite(current.wind_speed_10m) ?? 0,
    isDay: current.is_day !== 0,
  };

  const dailyRecord = record(root.daily);
  const dates = Array.isArray(dailyRecord?.time) ? dailyRecord.time : [];
  const codes = Array.isArray(dailyRecord?.weather_code) ? dailyRecord.weather_code : [];
  const maxima = Array.isArray(dailyRecord?.temperature_2m_max)
    ? dailyRecord.temperature_2m_max
    : [];
  const minima = Array.isArray(dailyRecord?.temperature_2m_min)
    ? dailyRecord.temperature_2m_min
    : [];

  const daily: WeatherDay[] = [];
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const code = finite(codes[index]);
    const max = finite(maxima[index]);
    const min = finite(minima[index]);
    if (typeof date !== "string" || code === null || max === null || min === null) continue;
    daily.push({ date, weatherCode: code, maxC: max, minC: min });
  }

  return {
    ok: true,
    location,
    current: currentWeather,
    daily,
    fetchedAt: Date.now(),
    stale: false,
    attribution: ATTRIBUTION,
  };
}

function pruneCache() {
  if (store.cache.size <= 50) return;
  const now = Date.now();
  for (const [key, entry] of store.cache) {
    if (entry.expiresAt <= now) store.cache.delete(key);
  }
  while (store.cache.size > 50) {
    const oldest = store.cache.keys().next().value as string | undefined;
    if (!oldest) break;
    store.cache.delete(oldest);
  }
}

export async function getWeather(location: WeatherLocation): Promise<WeatherPayload> {
  const key = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
  const now = Date.now();
  const cached = store.cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const pending = store.inflight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<WeatherPayload> => {
    try {
      const url = new URL(FORECAST_URL);
      url.searchParams.set("latitude", location.latitude.toFixed(4));
      url.searchParams.set("longitude", location.longitude.toFixed(4));
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
        ].join(","),
      );
      url.searchParams.set(
        "daily",
        ["weather_code", "temperature_2m_max", "temperature_2m_min"].join(","),
      );
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "4");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new WeatherError(`weather_upstream_${response.status}`);
      }

      const payload = parseOpenMeteo(await response.json(), location);
      store.cache.set(key, {
        expiresAt: Date.now() + WEATHER_CACHE_TTL_SECONDS * 1_000,
        payload,
      });
      pruneCache();
      return payload;
    } catch (error) {
      if (cached) return { ...cached.payload, stale: true };
      if (error instanceof WeatherError) throw error;
      throw new WeatherError("weather_unavailable");
    } finally {
      store.inflight.delete(key);
    }
  })();

  store.inflight.set(key, promise);
  return promise;
}
