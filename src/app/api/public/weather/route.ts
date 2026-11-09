import { NextResponse } from "next/server";
import {
  WEATHER_DEFAULT_LAT,
  WEATHER_DEFAULT_LON,
  WEATHER_ENABLED,
} from "@/config/weather";
import { getDefaultHotel } from "@/server/public/hotels";
import { getWeather } from "@/server/weather/open-meteo";

export const runtime = "nodejs";

function coordinate(value: unknown, fallback: number): number {
  const parsed = value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Credential-free weather proxy for the header chip and account dashboard.
 *
 *   GET /api/public/weather
 *
 * The route is cached at the edge/browser and additionally inside
 * `src/server/weather/open-meteo.ts`. It never accepts coordinates from the
 * client: the visible hotel is resolved server-side.
 */
export async function GET() {
  if (!WEATHER_ENABLED) {
    return NextResponse.json(
      { ok: false, error: "weather_disabled" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const hotel = await getDefaultHotel();
  if (!hotel) {
    return NextResponse.json(
      { ok: false, error: "weather_unavailable" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const payload = await getWeather({
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      latitude: coordinate(hotel.latitude, WEATHER_DEFAULT_LAT),
      longitude: coordinate(hotel.longitude, WEATHER_DEFAULT_LON),
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
        "x-weather-source": "open-meteo",
      },
    });
  } catch (error) {
    console.error("weather request failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "weather_unavailable" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
