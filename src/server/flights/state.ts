import { normalizeFlightQuery, type Aircraft } from "@/lib/flights";

/**
 * Pure OpenSky state-vector parsing and callsign matching. Kept separate from
 * the network/token code so it can be unit-tested without credentials.
 */

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * OpenSky returns each state vector as a positional array (see the REST docs).
 * Indexes used here: 0 icao24, 1 callsign, 2 country, 4 last_contact,
 * 5 longitude, 6 latitude, 7 baro_altitude, 8 on_ground, 9 velocity,
 * 10 true_track, 11 vertical_rate, 13 geo_altitude, 14 squawk,
 * 16 position_source, 17 category.
 */
export function aircraftFromStateRow(row: unknown): Aircraft | null {
  if (!Array.isArray(row)) return null;

  const icao24 = typeof row[0] === "string" ? row[0].trim().toLowerCase() : "";
  const longitude = numberOrNull(row[5]);
  const latitude = numberOrNull(row[6]);

  if (!icao24 || longitude === null || latitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    icao24,
    callsign: stringOrNull(row[1]),
    originCountry: typeof row[2] === "string" ? row[2] : "Unknown",
    latitude,
    longitude,
    altitudeM: numberOrNull(row[7]),
    geoAltitudeM: numberOrNull(row[13]),
    onGround: row[8] === true,
    velocityMps: numberOrNull(row[9]),
    headingDeg: numberOrNull(row[10]),
    verticalRateMps: numberOrNull(row[11]),
    squawk: stringOrNull(row[14]),
    lastContact: numberOrNull(row[4]),
    positionSource: numberOrNull(row[16]),
    category: numberOrNull(row[17]),
  };
}

export function parseStatesPayload(payload: unknown): {
  time: number | null;
  aircraft: Aircraft[];
} {
  if (!payload || typeof payload !== "object") return { time: null, aircraft: [] };
  const record = payload as { time?: unknown; states?: unknown };
  const time = typeof record.time === "number" ? record.time : null;
  const rows = Array.isArray(record.states) ? record.states : [];
  const aircraft = rows
    .map(aircraftFromStateRow)
    .filter((state): state is Aircraft => state !== null);
  return { time, aircraft };
}

function trailingDigits(value: string): string {
  return value.match(/\d+$/)?.[0] ?? "";
}

/**
 * Ranks a callsign against a user query. Lower is better; null = no match.
 *
 * OpenSky broadcasts the *ICAO* callsign (e.g. BAW117), while guests usually
 * know the IATA flight number (BA117). There is no free lookup table in the
 * API, so the final heuristic accepts the same trailing flight number with the
 * same leading airline letter. Exact and prefix matches always win.
 */
export function callsignMatchRank(callsign: string | null, query: string): number | null {
  if (!callsign) return null;
  const code = normalizeFlightQuery(callsign);
  const wanted = normalizeFlightQuery(query);
  if (!code || !wanted) return null;

  if (code === wanted) return 0;
  if (code.startsWith(wanted)) return 1;
  if (wanted.startsWith(code)) return 2;

  const codeDigits = trailingDigits(code);
  const wantedDigits = trailingDigits(wanted);
  if (codeDigits && wantedDigits && codeDigits === wantedDigits && code[0] === wanted[0]) {
    return 3;
  }
  if (/^\d{2,4}$/.test(wanted) && codeDigits.endsWith(wanted)) return 4;

  if (wanted.length >= 3 && code.includes(wanted)) return 5;
  return null;
}

export function sortAircraft(aircraft: Aircraft[]): Aircraft[] {
  return [...aircraft].sort((a, b) =>
    (a.callsign ?? a.icao24).localeCompare(b.callsign ?? b.icao24, "en", {
      sensitivity: "base",
    }),
  );
}

export function filterAndRankAircraft(
  aircraft: Aircraft[],
  query: string,
  limit: number,
): Aircraft[] {
  const ranked: Array<{ rank: number; aircraft: Aircraft }> = [];
  for (const state of aircraft) {
    const rank = callsignMatchRank(state.callsign, query);
    if (rank !== null) ranked.push({ rank, aircraft: state });
  }

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.aircraft.callsign ?? a.aircraft.icao24).localeCompare(
        b.aircraft.callsign ?? b.aircraft.icao24,
        "en",
        { sensitivity: "base" },
      ),
  );

  return ranked.slice(0, Math.max(0, limit)).map((entry) => entry.aircraft);
}
