import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moneyLocale } from "../src/lib/currency";

describe("money locale", () => {
  it("uses Nigerian and US locales for the supported display currencies", () => {
    assert.equal(moneyLocale("NGN"), "en-NG");
    assert.equal(moneyLocale("USD"), "en-US");
  });

  it("does not use Malaysian locale formatting for legacy currency values", () => {
    assert.equal(moneyLocale("MYR"), "en-NG");
  });
});
