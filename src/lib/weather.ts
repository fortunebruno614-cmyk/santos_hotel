/**
 * Shared weather types and WMO-code helpers. Safe for client and server: no
 * credentials or server-only modules.
 */
import type { Translator } from "@/lib/dictionaries";

export type WeatherLocation = {
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
};

export type WeatherCurrent = {
  time: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  precipitationMm: number;
  weatherCode: number;
  windKmh: number;
  isDay: boolean;
};

export type WeatherDay = {
  date: string;
  weatherCode: number;
  maxC: number;
  minC: number;
};

export type WeatherPayload = {
  ok: true;
  location: WeatherLocation;
  current: WeatherCurrent;
  daily: WeatherDay[];
  fetchedAt: number;
  stale: boolean;
  attribution: string;
};

export type WeatherErrorPayload = {
  ok: false;
  error: "weather_unavailable" | "weather_disabled";
};

export type WeatherConditionKey =
  | "weather.clear"
  | "weather.mainlyClear"
  | "weather.partlyCloudy"
  | "weather.overcast"
  | "weather.fog"
  | "weather.drizzle"
  | "weather.freezingDrizzle"
  | "weather.rain"
  | "weather.freezingRain"
  | "weather.snow"
  | "weather.snowGrains"
  | "weather.showers"
  | "weather.snowShowers"
  | "weather.thunderstorm"
  | "weather.thunderstormHail"
  | "weather.unknown";

/** WMO weather interpretation codes used by Open-Meteo. */
export function weatherConditionKey(code: number): WeatherConditionKey {
  if (code === 0) return "weather.clear";
  if (code === 1) return "weather.mainlyClear";
  if (code === 2) return "weather.partlyCloudy";
  if (code === 3) return "weather.overcast";
  if (code === 45 || code === 48) return "weather.fog";
  if (code === 51 || code === 53 || code === 55) return "weather.drizzle";
  if (code === 56 || code === 57) return "weather.freezingDrizzle";
  if (code === 61 || code === 63 || code === 65) return "weather.rain";
  if (code === 66 || code === 67) return "weather.freezingRain";
  if (code === 71 || code === 73 || code === 75) return "weather.snow";
  if (code === 77) return "weather.snowGrains";
  if (code === 80 || code === 81 || code === 82) return "weather.showers";
  if (code === 85 || code === 86) return "weather.snowShowers";
  if (code === 95) return "weather.thunderstorm";
  if (code === 96 || code === 99) return "weather.thunderstormHail";
  return "weather.unknown";
}

export function weatherConditionLabel(code: number, t: Translator): string {
  return t(weatherConditionKey(code));
}

/** Day label for the forecast strip; dates are YYYY-MM-DD from Open-Meteo. */
export function weatherDayLabel(
  date: string,
  locale: string,
  t: Translator,
  isToday: boolean,
): string {
  if (isToday) return t("weather.today");
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(parsed);
}

export function weatherUpdatedLabel(
  fetchedAt: number,
  locale: string,
  t: Translator,
): string {
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fetchedAt));
  return t("weather.updated", { time });
}
