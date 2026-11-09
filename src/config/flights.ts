/**
 * Flight tracking configuration (OpenSky Network).
 *
 * The client id/secret are SERVER-ONLY. Nothing in this module may be imported
 * by a Client Component: pages pass the resolved centre/bbox to the browser as
 * props, and the browser only ever talks to our own `/api/public/flights`.
 *
 *   OPENSKY_CLIENT_ID              OAuth2 API client id (OpenSky account page)
 *   OPENSKY_CLIENT_SECRET          OAuth2 API client secret — never expose it
 *   OPENSKY_CACHE_TTL_SECONDS      How long a live state response is reused
 *                                  (default 120s; protects the daily credit cap)
 *   FLIGHT_BBOX_SPAN_DEG           Degrees added around the hotel for the
 *                                  default regional view (default 4 ≈ 64 sq°)
 *   FLIGHT_DEFAULT_LAT/LON         Fallback centre when the hotel has no
 *                                  verified map coordinates
 *   FLIGHT_DEFAULT_ZOOM            Initial regional map zoom
 *   FLIGHT_MAX_AIRCRAFT            Server cap on returned state vectors
 */

function envString(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value : fallback;
}

function envNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID?.trim() || null;
export const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET?.trim() || null;

export const OPENSKY_API_BASE = envString(
  process.env.OPENSKY_API_BASE,
  "https://opensky-network.org/api",
).replace(/\/+$/, "");

export const OPENSKY_TOKEN_URL = envString(
  process.env.OPENSKY_TOKEN_URL,
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
);

export const OPENSKY_TIMEOUT_MS = envInt(process.env.OPENSKY_TIMEOUT_MS, 12_000, 2_000, 30_000);
export const OPENSKY_CACHE_TTL_SECONDS = envInt(
  process.env.OPENSKY_CACHE_TTL_SECONDS,
  120,
  15,
  600,
);

export const FLIGHT_BBOX_SPAN_DEG = envInt(process.env.FLIGHT_BBOX_SPAN_DEG, 4, 1, 15);
export const FLIGHT_DEFAULT_LAT = envNumber(process.env.FLIGHT_DEFAULT_LAT, 6.426588);
export const FLIGHT_DEFAULT_LON = envNumber(process.env.FLIGHT_DEFAULT_LON, 3.429399);
export const FLIGHT_DEFAULT_ZOOM = envInt(process.env.FLIGHT_DEFAULT_ZOOM, 6, 2, 12);
export const FLIGHT_MAX_AIRCRAFT = envInt(process.env.FLIGHT_MAX_AIRCRAFT, 250, 25, 1_000);

/** Largest bbox (in square degrees) the public endpoint will forward. */
export const OPENSKY_MAX_BBOX_AREA = envInt(process.env.OPENSKY_MAX_BBOX_AREA, 400, 1, 1_600);

export function openskyConfigured(): boolean {
  return Boolean(OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET);
}
