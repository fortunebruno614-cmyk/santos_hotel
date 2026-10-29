import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasCoordinates, mapZoomForCoordinates } from "../src/lib/hotel";
import { SettingsPatchSchema } from "../src/server/console/validation";

describe("hotel map coordinates", () => {
  it("accepts a complete coordinate pair", () => {
    assert.equal(hasCoordinates({ latitude: 6.4541, longitude: 3.3947 }), true);
  });

  it("rejects missing halves and non-finite values", () => {
    assert.equal(hasCoordinates({ latitude: null, longitude: null }), false);
    assert.equal(hasCoordinates({ latitude: 6.4541, longitude: null }), false);
    assert.equal(hasCoordinates({ latitude: null, longitude: 3.3947 }), false);
    assert.equal(hasCoordinates({ latitude: Number.NaN, longitude: 3.3947 }), false);
    assert.equal(hasCoordinates({ latitude: 6.4541, longitude: Number.POSITIVE_INFINITY }), false);
  });
});

describe("map zoom never exceeds coordinate precision (MR-04)", () => {
  it("opens at a wider view for coarser coordinates", () => {
    // City-level precision (~1 km) must not zoom to street level.
    assert.equal(mapZoomForCoordinates(6.45, 3.39), 11);
    assert.equal(mapZoomForCoordinates(6.454, 3.394), 13);
  });

  it("opens closer only when the stored coordinates support it", () => {
    assert.equal(mapZoomForCoordinates(6.4541, 3.3947), 14);
    // Trailing zeros do not count as precision (JS drops them).
    assert.equal(mapZoomForCoordinates(6.45410, 3.39470), 14);
    assert.equal(mapZoomForCoordinates(6.45411, 3.39472), 16);
  });

  it("uses the coarser of the two precisions", () => {
    assert.equal(mapZoomForCoordinates(6.45410, 3.39), 11);
  });
});

describe("settings patch: verified map coordinates (MR-07)", () => {
  it("accepts a complete pair", () => {
    const parsed = SettingsPatchSchema.safeParse({ latitude: 6.4541, longitude: 3.3947 });
    assert.equal(parsed.success, true);
  });

  it("accepts clearing both coordinates", () => {
    const parsed = SettingsPatchSchema.safeParse({ latitude: null, longitude: null });
    assert.equal(parsed.success, true);
  });

  it("rejects a lone coordinate (never half a position)", () => {
    assert.equal(SettingsPatchSchema.safeParse({ latitude: 6.4541 }).success, false);
    assert.equal(SettingsPatchSchema.safeParse({ longitude: 3.3947 }).success, false);
    assert.equal(
      SettingsPatchSchema.safeParse({ latitude: 6.4541, longitude: null }).success,
      false,
    );
  });

  it("rejects out-of-range coordinates", () => {
    assert.equal(
      SettingsPatchSchema.safeParse({ latitude: 91, longitude: 3.3947 }).success,
      false,
    );
    assert.equal(
      SettingsPatchSchema.safeParse({ latitude: 6.4541, longitude: 181 }).success,
      false,
    );
  });

  it("still validates the existing settings fields", () => {
    assert.equal(SettingsPatchSchema.safeParse({ name: "Santo Hotel" }).success, true);
    assert.equal(SettingsPatchSchema.safeParse({}).success, false);
    assert.equal(SettingsPatchSchema.safeParse({ currency: "NGN" }).success, true);
    assert.equal(SettingsPatchSchema.safeParse({ currency: "NOPE" }).success, false);
  });
});
