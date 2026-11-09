import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callsignMatchRank,
  filterAndRankAircraft,
  parseStatesPayload,
  sortAircraft,
  aircraftFromStateRow,
} from "../../src/server/flights/state";
import {
  bboxAround,
  formatBbox,
  parseBbox,
  parseFlightsQuery,
  resolveFlightCenter,
} from "../../src/server/flights/validation";
import type { Aircraft } from "../../src/lib/flights";

function stateRow(overrides: Record<number, unknown> = {}): unknown[] {
  const row: unknown[] = [
    "ABC123",
    "BAW117 ",
    "United Kingdom",
    1_700_000_000,
    1_700_000_005,
    -0.1,
    51.5,
    10_000,
    false,
    250,
    90,
    0,
    null,
    10_050,
    "1234",
    false,
    0,
    4,
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function aircraft(overrides: Partial<Aircraft>): Aircraft {
  return {
    icao24: "abc123",
    callsign: "BAW117",
    originCountry: "United Kingdom",
    latitude: 51.5,
    longitude: -0.1,
    altitudeM: 10_000,
    geoAltitudeM: 10_050,
    onGround: false,
    velocityMps: 250,
    headingDeg: 90,
    verticalRateMps: 0,
    squawk: "1234",
    lastContact: 1_700_000_005,
    positionSource: 0,
    category: 4,
    ...overrides,
  };
}

describe("aircraftFromStateRow", () => {
  it("parses a documented OpenSky state vector", () => {
    const parsed = aircraftFromStateRow(stateRow());
    assert.ok(parsed);
    assert.equal(parsed.icao24, "abc123");
    assert.equal(parsed.callsign, "BAW117");
    assert.equal(parsed.latitude, 51.5);
    assert.equal(parsed.longitude, -0.1);
    assert.equal(parsed.altitudeM, 10_000);
    assert.equal(parsed.velocityMps, 250);
    assert.equal(parsed.headingDeg, 90);
    assert.equal(parsed.squawk, "1234");
  });

  it("drops rows without a position", () => {
    assert.equal(aircraftFromStateRow(stateRow({ 5: null })), null);
    assert.equal(aircraftFromStateRow(stateRow({ 6: null })), null);
    assert.equal(aircraftFromStateRow([]), null);
    assert.equal(aircraftFromStateRow("nope"), null);
  });

  it("handles a null states payload", () => {
    assert.deepEqual(parseStatesPayload({ time: 1_700_000_000, states: null }), {
      time: 1_700_000_000,
      aircraft: [],
    });
    assert.deepEqual(parseStatesPayload(null), { time: null, aircraft: [] });
  });
});

describe("callsign matching", () => {
  it("ranks exact, prefix and reverse-prefix matches", () => {
    assert.equal(callsignMatchRank("BAW117", "BAW117"), 0);
    assert.equal(callsignMatchRank("BAW117", "BAW"), 1);
    assert.equal(callsignMatchRank("BAW", "BAW117"), 2);
  });

  it("matches an IATA flight number to its ICAO callsign", () => {
    assert.equal(callsignMatchRank("BAW117", "BA117"), 3);
    assert.equal(callsignMatchRank("KLM1023", "KL1023"), 3);
    assert.equal(callsignMatchRank("BAW117", "117"), 4);
  });

  it("does not match an unrelated flight", () => {
    assert.equal(callsignMatchRank("BAW117", "AFR999"), null);
    assert.equal(callsignMatchRank(null, "BAW117"), null);
  });

  it("sorts exact matches before prefix matches", () => {
    const result = filterAndRankAircraft(
      [aircraft({ icao24: "1", callsign: "BAW1170" }), aircraft({ icao24: "2", callsign: "BAW117" })],
      "BAW117",
      5,
    );
    assert.deepEqual(
      result.map((item) => item.icao24),
      ["2", "1"],
    );
  });

  it("sorts a flight list by callsign", () => {
    const sorted = sortAircraft([
      aircraft({ icao24: "1", callsign: "KLM1023" }),
      aircraft({ icao24: "2", callsign: "BAW117" }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.callsign),
      ["BAW117", "KLM1023"],
    );
  });
});

describe("flight query validation", () => {
  it("accepts and normalises callsign searches", () => {
    const parsed = parseFlightsQuery(new URLSearchParams({ callsign: " ba 117 " }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.callsign, "BA117");
  });

  it("accepts a bounded regional request", () => {
    const parsed = parseFlightsQuery(
      new URLSearchParams({ bbox: "45.8,5.9,47.8,10.5", limit: "120" }),
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.callsign, null);
      assert.equal(parsed.value.limit, 120);
      assert.equal(parsed.value.bbox?.lamin, 45.8);
    }
  });

  it("accepts an explicit worldwide request without a bbox", () => {
    const parsed = parseFlightsQuery(new URLSearchParams({ scope: "world" }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.bbox, null);
  });

  it("rejects missing, inverted or oversized bounds", () => {
    assert.equal(parseFlightsQuery(new URLSearchParams()).ok, false);
    assert.equal(parseBbox("48,6,46,10"), null);
    assert.equal(parseBbox("-91,6,10,10"), null);
    assert.equal(parseBbox("0,0,30,30"), null); // 900 sq° > default 400 credit guard
  });

  it("rejects invalid callsigns", () => {
    assert.equal(parseFlightsQuery(new URLSearchParams({ callsign: "A" })).ok, false);
    assert.equal(parseFlightsQuery(new URLSearchParams({ callsign: "!!!" })).ok, false);
  });

  it("builds a clamped bbox around the default centre", () => {
    const bbox = bboxAround(resolveFlightCenter(null, null), 4);
    assert.equal(formatBbox(bbox).split(",").length, 4);
    assert.ok(bbox.lamin < bbox.lamax);
    assert.ok(bbox.lomin < bbox.lomax);
    assert.ok(bbox.lamin >= -90 && bbox.lamax <= 90);
  });
});
