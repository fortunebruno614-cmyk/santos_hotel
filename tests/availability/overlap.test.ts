import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  expandNights,
  intervalsOverlap,
  nightsCount,
  parseDateOnly,
  toUtcDateOnly,
} from "../../src/server/availability/overlap";

const win = (checkIn: string, checkOut: string) => ({
  checkIn: parseDateOnly(checkIn)!,
  checkOut: parseDateOnly(checkOut)!,
});

const WINDOWS = [
  win("2027-01-01", "2027-01-04"),
  win("2027-01-04", "2027-01-06"), // back-to-back with the first
  win("2027-01-03", "2027-01-05"), // partial overlap
  win("2027-01-02", "2027-01-03"), // contained
  win("2027-01-10", "2027-01-12"), // disjoint
  win("2027-01-01", "2027-01-12"), // contains the first
];

describe("parseDateOnly", () => {
  it("parses YYYY-MM-DD as UTC midnight", () => {
    const date = parseDateOnly("2027-03-01")!;
    assert.equal(date.toISOString(), "2027-03-01T00:00:00.000Z");
  });

  it("rejects impossible or mis-shaped dates", () => {
    assert.equal(parseDateOnly("2027-02-30"), null);
    assert.equal(parseDateOnly("2027-13-01"), null);
    assert.equal(parseDateOnly("01-03-2027"), null);
    assert.equal(parseDateOnly("2027-3-1"), null);
    assert.equal(parseDateOnly("not-a-date"), null);
  });
});

describe("date arithmetic", () => {
  it("toUtcDateOnly strips any time-of-day", () => {
    const date = toUtcDateOnly(new Date("2027-03-01T13:45:12.000Z"));
    assert.equal(date.toISOString(), "2027-03-01T00:00:00.000Z");
  });

  it("addDays crosses month and year boundaries", () => {
    assert.equal(addDays(new Date(Date.UTC(2026, 11, 31)), 1).toISOString(), "2027-01-01T00:00:00.000Z");
    assert.equal(addDays(new Date(Date.UTC(2027, 1, 27)), 2).toISOString(), "2027-03-01T00:00:00.000Z");
  });

  it("daysBetween / nightsCount count nights, not days touched", () => {
    assert.equal(nightsCount(parseDateOnly("2027-03-01")!, parseDateOnly("2027-03-03")!), 2);
    assert.equal(daysBetween(parseDateOnly("2027-03-01")!, parseDateOnly("2027-03-02")!), 1);
    assert.equal(nightsCount(parseDateOnly("2026-12-31")!, parseDateOnly("2027-01-02")!), 2);
  });
});

describe("expandNights", () => {
  it("half-open [check_in, check_out) — checkout day is not held", () => {
    const nights = expandNights(parseDateOnly("2027-03-01")!, parseDateOnly("2027-03-03")!, true);
    assert.deepEqual(
      nights.map((n) => n.toISOString().slice(0, 10)),
      ["2027-03-01", "2027-03-02"],
    );
  });

  it("closed [check_in, check_out] when same-day turnover is disabled", () => {
    const nights = expandNights(parseDateOnly("2027-03-01")!, parseDateOnly("2027-03-03")!, false);
    assert.deepEqual(
      nights.map((n) => n.toISOString().slice(0, 10)),
      ["2027-03-01", "2027-03-02", "2027-03-03"],
    );
  });
});

describe("intervalsOverlap — the P4 rule", () => {
  it("half-open: identical windows overlap", () => {
    assert.equal(intervalsOverlap(win("2027-03-01", "2027-03-05"), win("2027-03-01", "2027-03-05"), true), true);
  });

  it("half-open: back-to-back stays never collide (same-day turnover)", () => {
    const departing = win("2027-03-01", "2027-03-05");
    const arriving = win("2027-03-05", "2027-03-08");
    assert.equal(intervalsOverlap(departing, arriving, true), false);
    assert.equal(intervalsOverlap(arriving, departing, true), false);
  });

  it("half-open: partial overlap in either direction collides", () => {
    assert.equal(intervalsOverlap(win("2027-03-01", "2027-03-05"), win("2027-03-04", "2027-03-08"), true), true);
    assert.equal(intervalsOverlap(win("2027-03-04", "2027-03-08"), win("2027-03-01", "2027-03-05"), true), true);
  });

  it("half-open: containment and disjointness", () => {
    assert.equal(intervalsOverlap(win("2027-03-01", "2027-03-10"), win("2027-03-03", "2027-03-05"), true), true);
    assert.equal(intervalsOverlap(win("2027-03-01", "2027-03-03"), win("2027-03-05", "2027-03-07"), true), false);
  });

  it("closed: a departure date is unavailable for arrival", () => {
    const departing = win("2027-03-01", "2027-03-05");
    const arrivingSameDay = win("2027-03-05", "2027-03-08");
    const arrivingNextDay = win("2027-03-06", "2027-03-09");
    assert.equal(intervalsOverlap(departing, arrivingSameDay, false), true);
    assert.equal(intervalsOverlap(arrivingSameDay, departing, false), true);
    assert.equal(intervalsOverlap(departing, arrivingNextDay, false), false);
  });

  it("overlap is symmetric for every window pair and both modes", () => {
    for (const mode of [true, false]) {
      for (const a of WINDOWS) {
        for (const b of WINDOWS) {
          assert.equal(
            intervalsOverlap(a, b, mode),
            intervalsOverlap(b, a, mode),
            `asymmetric for ${a.checkIn.toISOString()} / ${b.checkIn.toISOString()} mode=${mode}`,
          );
        }
      }
    }
  });

  it("matches the room_nights expansion: overlap <=> shared night (both modes)", () => {
    for (const mode of [true, false]) {
      for (const a of WINDOWS) {
        for (const b of WINDOWS) {
          const nightsA = new Set(expandNights(a.checkIn, a.checkOut, mode).map((n) => n.getTime()));
          const sharesNight = expandNights(b.checkIn, b.checkOut, mode).some((n) => nightsA.has(n.getTime()));
          assert.equal(
            intervalsOverlap(a, b, mode),
            sharesNight,
            `policy/ledger divergence: ${a.checkIn.toISOString()} vs ${b.checkIn.toISOString()} mode=${mode}`,
          );
        }
      }
    }
  });
});
