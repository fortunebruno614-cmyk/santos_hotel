import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StaySearchSchema, MAX_STAY_NIGHTS } from "../../src/server/availability/validation";

describe("StaySearchSchema", () => {
  it("accepts a minimal query and defaults occupancy", () => {
    const parsed = StaySearchSchema.parse({ checkIn: "2027-03-01", checkOut: "2027-03-03" });
    assert.deepEqual(parsed, { checkIn: "2027-03-01", checkOut: "2027-03-03", adults: 1, children: 0 });
  });

  it("coerces numeric strings from the query string", () => {
    const parsed = StaySearchSchema.parse({
      checkIn: "2027-03-01",
      checkOut: "2027-03-03",
      adults: "2",
      children: "3",
    });
    assert.equal(parsed.adults, 2);
    assert.equal(parsed.children, 3);
  });

  it("rejects missing or impossible dates", () => {
    assert.equal(StaySearchSchema.safeParse({ checkOut: "2027-03-03" }).success, false);
    assert.equal(
      StaySearchSchema.safeParse({ checkIn: "2027-02-30", checkOut: "2027-03-03" }).success,
      false,
    );
  });

  it("rejects checkOut on or before checkIn (no zero-night stays)", () => {
    assert.equal(
      StaySearchSchema.safeParse({ checkIn: "2027-03-03", checkOut: "2027-03-03" }).success,
      false,
    );
    assert.equal(
      StaySearchSchema.safeParse({ checkIn: "2027-03-03", checkOut: "2027-03-01" }).success,
      false,
    );
  });

  it("rejects occupancy outside 1..20 adults / 0..20 children", () => {
    const base = { checkIn: "2027-03-01", checkOut: "2027-03-03" };
    assert.equal(StaySearchSchema.safeParse({ ...base, adults: 0 }).success, false);
    assert.equal(StaySearchSchema.safeParse({ ...base, adults: 21 }).success, false);
    assert.equal(StaySearchSchema.safeParse({ ...base, children: -1 }).success, false);
    assert.equal(StaySearchSchema.safeParse({ ...base, children: 21 }).success, false);
  });

  it(`enforces the ${MAX_STAY_NIGHTS}-night query guard at exactly the boundary`, () => {
    // 2027-01-01 -> 2027-03-02 is exactly 60 nights (31 + 28 + 1).
    assert.equal(
      StaySearchSchema.safeParse({ checkIn: "2027-01-01", checkOut: "2027-03-02" }).success,
      true,
    );
    assert.equal(
      StaySearchSchema.safeParse({ checkIn: "2027-01-01", checkOut: "2027-03-03" }).success,
      false,
    );
  });
});
