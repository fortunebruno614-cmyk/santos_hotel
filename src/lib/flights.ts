/**
 * Shared flight-tracking types. Safe to import from client and server code —
 * no credentials or server-only configuration live here.
 */

export type FlightBbox = {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
};

/** A normalised OpenSky state vector. */
export type Aircraft = {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  geoAltitudeM: number | null;
  onGround: boolean;
  velocityMps: number | null;
  headingDeg: number | null;
  verticalRateMps: number | null;
  squawk: string | null;
  lastContact: number | null;
  positionSource: number | null;
  category: number | null;
};

export type FlightsApiResponse = {
  ok: true;
  aircraft: Aircraft[];
  count: number;
  time: number | null;
  fetchedAt: number;
  cached: boolean;
  creditsRemaining: number | null;
  attribution: string;
  query: string | null;
  bounds: FlightBbox | null;
};

export type FlightsApiError = {
  ok: false;
  error: string;
  retryAfterSec?: number;
};

export type FlightCenter = {
  lat: number;
  lng: number;
};

/** Uppercase, strip separators and whitespace: "ba 117" -> "BA117". */
export function normalizeFlightQuery(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidFlightQuery(value: string): boolean {
  return /^[A-Z0-9]{2,10}$/.test(value);
}

/** 0 = north, 90 = east, ... */
export function compassPoint(heading: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const index = Math.round((((heading % 360) + 360) % 360) / 45) % 8;
  return points[index];
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function mpsToKmh(mps: number): number {
  return mps * 3.6;
}

export function mpsToKnots(mps: number): number {
  return mps * 1.943844;
}

export function mpsToFeetPerMinute(mps: number): number {
  return mps * 196.8504;
}
