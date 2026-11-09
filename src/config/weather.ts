/**
 * Weather widget configuration. Open-Meteo is a keyless public API, so there
 * is no credential to protect — the browser still talks only to our own cached
 * `/api/public/weather` route, which keeps upstream failures and rate limits
 * off the client.
 *
 *   WEATHER_ENABLED              false hides the widget and disables the route
 *   WEATHER_CACHE_TTL_SECONDS    upstream cache (default 15 minutes)
 *   WEATHER_TIMEOUT_MS           upstream request ceiling
 *   WEATHER_DEFAULT_LAT/LON      centre when the hotel has no map coordinates
 */

function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function envNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const WEATHER_ENABLED = process.env.WEATHER_ENABLED !== "false";
export const WEATHER_CACHE_TTL_SECONDS = envInt(
  process.env.WEATHER_CACHE_TTL_SECONDS,
  900,
  60,
  3_600,
);
export const WEATHER_TIMEOUT_MS = envInt(process.env.WEATHER_TIMEOUT_MS, 8_000, 2_000, 20_000);
export const WEATHER_DEFAULT_LAT = envNumber(process.env.WEATHER_DEFAULT_LAT, 6.426588);
export const WEATHER_DEFAULT_LON = envNumber(process.env.WEATHER_DEFAULT_LON, 3.429399);
