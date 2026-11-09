import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  weatherConditionKey,
  weatherDayLabel,
  weatherUpdatedLabel,
  type WeatherLocation,
} from "../../src/lib/weather";
import { parseOpenMeteo } from "../../src/server/weather/open-meteo";
import { makeTranslator } from "../../src/lib/dictionaries";

const location: WeatherLocation = {
  name: "Santo Hotel",
  city: "Lagos",
  country: "Nigeria",
  latitude: 6.426588,
  longitude: 3.429399,
};

function sample() {
  return {
    latitude: 6.43,
    longitude: 3.43,
    current_units: {
      temperature_2m: "°C",
      wind_speed_10m: "km/h",
    },
    current: {
      time: "2026-11-09T21:15",
      interval: 900,
      temperature_2m: 26.3,
      relative_humidity_2m: 87,
      apparent_temperature: 31.6,
      is_day: 0,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 5.3,
    },
    daily_units: {
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
    },
    daily: {
      time: ["2026-11-09", "2026-11-10", "2026-11-11"],
      weather_code: [95, 81, 51],
      temperature_2m_max: [32.4, 28.4, 29.9],
      temperature_2m_min: [25.4, 25.1, 24.7],
    },
  };
}

describe("WMO weather codes", () => {
  it("maps the common Open-Meteo codes to dictionary keys", () => {
    assert.equal(weatherConditionKey(0), "weather.clear");
    assert.equal(weatherConditionKey(2), "weather.partlyCloudy");
    assert.equal(weatherConditionKey(45), "weather.fog");
    assert.equal(weatherConditionKey(61), "weather.rain");
    assert.equal(weatherConditionKey(71), "weather.snow");
    assert.equal(weatherConditionKey(95), "weather.thunderstorm");
    assert.equal(weatherConditionKey(999), "weather.unknown");
  });

  it("formats the forecast day and update time", () => {
    const t = makeTranslator("en");
    assert.equal(weatherDayLabel("2026-11-09", "en", t, true), "Today");
    assert.match(weatherDayLabel("2026-11-10", "en", t, false), /Tue/);
    assert.match(weatherUpdatedLabel(1_700_000_000_000, "en", t), /Updated/);
  });
});

describe("parseOpenMeteo", () => {
  it("normalises the current conditions and four-day forecast", () => {
    const parsed = parseOpenMeteo(sample(), location);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.current.temperatureC, 26.3);
    assert.equal(parsed.current.feelsLikeC, 31.6);
    assert.equal(parsed.current.humidityPercent, 87);
    assert.equal(parsed.current.isDay, false);
    assert.equal(parsed.current.windKmh, 5.3);
    assert.equal(parsed.daily.length, 3);
    assert.deepEqual(parsed.daily[0], {
      date: "2026-11-09",
      weatherCode: 95,
      maxC: 32.4,
      minC: 25.4,
    });
    assert.equal(parsed.location.city, "Lagos");
    assert.equal(parsed.stale, false);
  });

  it("skips incomplete daily rows and falls back for optional current values", () => {
    const payload = sample();
    payload.daily = {
      time: ["2026-11-09", "2026-11-10"],
      weather_code: [95],
      temperature_2m_max: [32.4],
      temperature_2m_min: [25.4],
    };
    const parsed = parseOpenMeteo(payload, location);
    assert.equal(parsed.daily.length, 1);
  });

  it("rejects a response without a current temperature", () => {
    assert.throws(() => parseOpenMeteo({ current: {} }, location));
    assert.throws(() => parseOpenMeteo(null, location));
  });
});
