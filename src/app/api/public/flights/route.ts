import { NextResponse } from "next/server";
import { clientIp } from "@/server/auth/request";
import { listLiveAircraft, OpenSkyError, type OpenSkyErrorCode } from "@/server/flights/opensky";
import { checkFlightRateLimit } from "@/server/flights/rate-limit";
import { parseFlightsQuery } from "@/server/flights/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  error: OpenSkyErrorCode | "invalid_query" | "rate_limited",
  retryAfterSec?: number,
) {
  const status =
    error === "invalid_query"
      ? 400
      : error === "not_configured"
        ? 503
        : error === "rate_limited"
          ? 429
          : 502;

  return NextResponse.json(
    {
      ok: false,
      error,
      ...(retryAfterSec ? { retryAfterSec } : {}),
    },
    {
      status,
      headers: {
        "cache-control": "private, no-store",
        ...(retryAfterSec ? { "retry-after": String(retryAfterSec) } : {}),
      },
    },
  );
}

/**
 * Public, credential-free flight feed.
 *
 * The browser only ever calls this route. The OpenSky client id/secret and the
 * OAuth bearer token stay in `src/server/flights/opensky.ts`, which also caches
 * the token and responses so repeated page refreshes do not burn API credits.
 */
export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const throttle = checkFlightRateLimit(ip);
  if (!throttle.allowed) {
    return errorResponse("rate_limited", throttle.retryAfterSec);
  }

  const query = parseFlightsQuery(new URL(request.url).searchParams);
  if (!query.ok) return errorResponse("invalid_query");

  try {
    const result = await listLiveAircraft(query.value);
    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-flight-data-source": "opensky",
        },
      },
    );
  } catch (error) {
    if (error instanceof OpenSkyError) {
      if (error.code !== "not_configured" && error.code !== "rate_limited") {
        console.error("OpenSky request failed", {
          code: error.code,
          status: error.status ?? null,
        });
      }
      return errorResponse(
        error.code === "auth_failed" || error.code === "upstream" || error.code === "timeout"
          ? "upstream"
          : error.code,
        error.retryAfterSec,
      );
    }

    console.error("OpenSky request failed", { code: "unexpected" });
    return errorResponse("upstream");
  }
}
