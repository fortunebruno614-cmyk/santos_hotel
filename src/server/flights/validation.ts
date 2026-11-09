import { z } from "zod";
import {
  FLIGHT_DEFAULT_LAT,
  FLIGHT_DEFAULT_LON,
  FLIGHT_MAX_AIRCRAFT,
  OPENSKY_MAX_BBOX_AREA,
} from "@/config/flights";
import {
  isValidFlightQuery,
  normalizeFlightQuery,
  type FlightBbox,
  type FlightCenter,
} from "@/lib/flights";

const RawQuerySchema = z.object({
  callsign: z.string().trim().max(32).optional(),
  bbox: z.string().trim().max(160).optional(),
  scope: z.enum(["world", "hotel"]).optional(),
  limit: z.coerce.number().int().min(1).max(1_000).optional(),
});

export type ParsedFlightsQuery = {
  callsign: string | null;
  bbox: FlightBbox | null;
  limit: number;
};

export type FlightsQueryResult =
  | { ok: true; value: ParsedFlightsQuery }
  | { ok: false; reason: "invalid_query" };

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function parseBbox(raw: string | undefined | null): FlightBbox | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || !parts.every(finite)) return null;

  const [lamin, lomin, lamax, lomax] = parts;
  if (lamin < -90 || lamax > 90 || lomin < -180 || lomax > 180) return null;
  if (lamin >= lamax || lomin >= lomax) return null;
  if ((lamax - lamin) * (lomax - lomin) > OPENSKY_MAX_BBOX_AREA) return null;

  return { lamin, lomin, lamax, lomax };
}

export function formatBbox(bbox: FlightBbox): string {
  return [bbox.lamin, bbox.lomin, bbox.lamax, bbox.lomax]
    .map((value) => value.toFixed(6))
    .join(",");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Square-ish regional view around the hotel, clamped to valid WGS84 bounds. */
export function bboxAround(center: FlightCenter, spanDegrees: number): FlightBbox {
  const span = Math.max(0.5, spanDegrees);
  const lamin = clamp(center.lat - span, -90, 90);
  const lamax = clamp(center.lat + span, -90, 90);
  const lomin = clamp(center.lng - span, -180, 180);
  const lomax = clamp(center.lng + span, -180, 180);
  return {
    lamin,
    lomin,
    lamax: Math.max(lamin + 0.01, lamax),
    lomax: Math.max(lomin + 0.01, lomax),
  };
}

export function resolveFlightCenter(latitude: unknown, longitude: unknown): FlightCenter {
  const lat = latitude === null || latitude === undefined || latitude === "" ? NaN : Number(latitude);
  const lng =
    longitude === null || longitude === undefined || longitude === "" ? NaN : Number(longitude);

  return {
    lat: finite(lat) && lat >= -90 && lat <= 90 ? lat : FLIGHT_DEFAULT_LAT,
    lng: finite(lng) && lng >= -180 && lng <= 180 ? lng : FLIGHT_DEFAULT_LON,
  };
}

/**
 * Query contract for `GET /api/public/flights`:
 *   ?callsign=BAW117            global live callsign search
 *   ?scope=world                worldwide live map (4 credits, cached)
 *   ?bbox=lamin,lomin,lamax,lomax  regional view around the hotel
 *   ?limit=1..1000              server-side result cap
 */
export function parseFlightsQuery(params: URLSearchParams): FlightsQueryResult {
  const parsed = RawQuerySchema.safeParse({
    callsign: params.get("callsign") ?? undefined,
    bbox: params.get("bbox") ?? undefined,
    scope: params.get("scope") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) return { ok: false, reason: "invalid_query" };

  const rawCallsign = parsed.data.callsign?.trim() ?? "";
  const callsign = rawCallsign ? normalizeFlightQuery(rawCallsign) : null;
  if (rawCallsign && (!callsign || !isValidFlightQuery(callsign))) {
    return { ok: false, reason: "invalid_query" };
  }

  const parsedBbox = parseBbox(parsed.data.bbox);
  if (parsed.data.bbox && !parsedBbox) return { ok: false, reason: "invalid_query" };

  // Callsign searches are always global. Otherwise the caller must explicitly
  // choose the worldwide feed or provide a valid hotel bbox.
  let bbox: FlightBbox | null = null;
  if (!callsign) {
    if (parsed.data.scope === "world") bbox = null;
    else if (parsedBbox) bbox = parsedBbox;
    else return { ok: false, reason: "invalid_query" };
  }

  return {
    ok: true,
    value: {
      callsign,
      bbox,
      limit: Math.min(parsed.data.limit ?? FLIGHT_MAX_AIRCRAFT, FLIGHT_MAX_AIRCRAFT),
    },
  };
}
