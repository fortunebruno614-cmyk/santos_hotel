import {
  OPENSKY_API_BASE,
  OPENSKY_CACHE_TTL_SECONDS,
  OPENSKY_CLIENT_ID,
  OPENSKY_CLIENT_SECRET,
  OPENSKY_TIMEOUT_MS,
  OPENSKY_TOKEN_URL,
  FLIGHT_MAX_AIRCRAFT,
  openskyConfigured,
} from "@/config/flights";
import type { Aircraft, FlightBbox } from "@/lib/flights";
import { filterAndRankAircraft, parseStatesPayload, sortAircraft } from "@/server/flights/state";
import { formatBbox } from "@/server/flights/validation";

export const OPENSKY_ATTRIBUTION = "Live flight data by OpenSky Network";

export type OpenSkyErrorCode =
  | "not_configured"
  | "auth_failed"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "invalid_response";

export class OpenSkyError extends Error {
  constructor(
    readonly code: OpenSkyErrorCode,
    readonly retryAfterSec?: number,
    readonly status?: number,
  ) {
    super(code);
    this.name = "OpenSkyError";
  }
}

type AccessToken = { value: string; expiresAt: number };

type CachedStates = {
  expiresAt: number;
  time: number | null;
  aircraft: Aircraft[];
  fetchedAt: number;
  creditsRemaining: number | null;
  bounds: FlightBbox | null;
  query: string | null;
};

export type LiveAircraftResult = {
  aircraft: Aircraft[];
  count: number;
  time: number | null;
  fetchedAt: number;
  cached: boolean;
  creditsRemaining: number | null;
  attribution: string;
  query: string | null;
  bounds: FlightBbox | null;
};

type OpenSkyStore = {
  token: AccessToken | null;
  tokenPromise: Promise<AccessToken> | null;
  cache: Map<string, CachedStates>;
  inflight: Map<string, Promise<CachedStates>>;
};

/**
 * Cache the OAuth token and responses on globalThis so dev-mode module reloads
 * do not hammer the token endpoint or waste API credits. Each Node process has
 * its own store; a multi-instance deployment gets one token per instance,
 * which is expected for the client-credentials flow.
 */
const globalStore = globalThis as unknown as { __santoOpenSky?: OpenSkyStore };
const store: OpenSkyStore =
  globalStore.__santoOpenSky ??
  (globalStore.__santoOpenSky = {
    token: null,
    tokenPromise: null,
    cache: new Map(),
    inflight: new Map(),
  });

function configuredCredentials(): { id: string; secret: string } {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    throw new OpenSkyError("not_configured");
  }
  return { id: OPENSKY_CLIENT_ID, secret: OPENSKY_CLIENT_SECRET };
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENSKY_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestToken(): Promise<AccessToken> {
  const { id, secret } = configuredCredentials();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });

  const response = await timedFetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    // Never surface the response body or credentials in the error.
    throw new OpenSkyError("auth_failed", undefined, response.status);
  }

  const data = (await response.json().catch(() => null)) as
    | { access_token?: unknown; expires_in?: unknown }
    | null;
  const value = typeof data?.access_token === "string" ? data.access_token : "";
  if (!value) throw new OpenSkyError("invalid_response", undefined, response.status);

  const expiresIn = typeof data?.expires_in === "number" ? data.expires_in : 1_800;
  // Refresh 60 seconds early; OpenSky tokens live about 30 minutes.
  const lifetimeSeconds = Math.max(60, expiresIn - 60);
  return { value, expiresAt: Date.now() + lifetimeSeconds * 1_000 };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  configuredCredentials(); // fail fast with not_configured

  if (!forceRefresh && store.token && store.token.expiresAt > Date.now()) {
    return store.token.value;
  }
  if (store.tokenPromise) {
    return (await store.tokenPromise).value;
  }

  const promise = requestToken()
    .then((token) => {
      store.token = token;
      return token;
    })
    .finally(() => {
      store.tokenPromise = null;
    });
  store.tokenPromise = promise;
  return (await promise).value;
}

function statesUrl(bbox: FlightBbox | null): string {
  const url = new URL(`${OPENSKY_API_BASE}/states/all`);
  url.searchParams.set("extended", "1");
  if (bbox) {
    url.searchParams.set("lamin", bbox.lamin.toFixed(6));
    url.searchParams.set("lomin", bbox.lomin.toFixed(6));
    url.searchParams.set("lamax", bbox.lamax.toFixed(6));
    url.searchParams.set("lomax", bbox.lomax.toFixed(6));
  }
  return url.toString();
}

function parseCredits(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

type StatesFetch =
  | { ok: true; data: unknown; creditsRemaining: number | null }
  | { ok: false; unauthorized: true };

async function fetchStatesOnce(bbox: FlightBbox | null, token: string): Promise<StatesFetch> {
  const response = await timedFetch(statesUrl(bbox), {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });

  if (response.status === 401) return { ok: false, unauthorized: true };

  if (response.status === 429) {
    const retryHeader =
      response.headers.get("x-rate-limit-retry-after-seconds") ??
      response.headers.get("retry-after");
    const retryAfterSec = Number(retryHeader);
    throw new OpenSkyError(
      "rate_limited",
      Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 60,
      429,
    );
  }

  if (!response.ok) {
    throw new OpenSkyError("upstream", undefined, response.status);
  }

  return {
    ok: true,
    data: await response.json().catch(() => null),
    creditsRemaining: parseCredits(response.headers.get("x-rate-limit-remaining")),
  };
}

async function fetchStates(bbox: FlightBbox | null) {
  try {
    const token = await getAccessToken();
    let result = await fetchStatesOnce(bbox, token);

    // Expired token: invalidate and retry exactly once with a fresh one.
    if (!result.ok) {
      store.token = null;
      const freshToken = await getAccessToken(true);
      result = await fetchStatesOnce(bbox, freshToken);
      if (!result.ok) throw new OpenSkyError("auth_failed", undefined, 401);
    }

    return { data: result.data, creditsRemaining: result.creditsRemaining };
  } catch (error) {
    if (error instanceof OpenSkyError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenSkyError("timeout");
    }
    throw new OpenSkyError("upstream");
  }
}

function pruneCache() {
  if (store.cache.size <= 100) return;
  const now = Date.now();
  for (const [key, entry] of store.cache) {
    if (entry.expiresAt <= now) store.cache.delete(key);
  }
  while (store.cache.size > 100) {
    const oldest = store.cache.keys().next().value as string | undefined;
    if (!oldest) break;
    store.cache.delete(oldest);
  }
}

function toResult(entry: CachedStates, limit: number, cached: boolean): LiveAircraftResult {
  const aircraft = entry.aircraft.slice(0, limit);
  return {
    aircraft,
    count: aircraft.length,
    time: entry.time,
    fetchedAt: entry.fetchedAt,
    cached,
    creditsRemaining: entry.creditsRemaining,
    attribution: OPENSKY_ATTRIBUTION,
    query: entry.query,
    bounds: entry.bounds,
  };
}

export async function listLiveAircraft(input: {
  callsign: string | null;
  bbox: FlightBbox | null;
  limit: number;
}): Promise<LiveAircraftResult> {
  if (!openskyConfigured()) throw new OpenSkyError("not_configured");

  const bbox = input.callsign ? null : input.bbox;
  const key = input.callsign
    ? `callsign:${input.callsign}`
    : `bbox:${bbox ? formatBbox(bbox) : "global"}`;
  const now = Date.now();

  const existing = store.cache.get(key);
  if (existing && existing.expiresAt > now) {
    return toResult(existing, input.limit, true);
  }

  const pending = store.inflight.get(key);
  if (pending) {
    return toResult(await pending, input.limit, false);
  }

  const promise = (async (): Promise<CachedStates> => {
    const { data, creditsRemaining } = await fetchStates(bbox);
    const { time, aircraft: all } = parseStatesPayload(data);
    const aircraft = input.callsign
      ? filterAndRankAircraft(all, input.callsign, FLIGHT_MAX_AIRCRAFT)
      : sortAircraft(all).slice(0, FLIGHT_MAX_AIRCRAFT);

    const entry: CachedStates = {
      expiresAt: Date.now() + OPENSKY_CACHE_TTL_SECONDS * 1_000,
      time,
      aircraft,
      fetchedAt: Date.now(),
      creditsRemaining,
      bounds: bbox,
      query: input.callsign,
    };
    store.cache.set(key, entry);
    pruneCache();
    return entry;
  })().finally(() => {
    store.inflight.delete(key);
  });

  store.inflight.set(key, promise);
  return toResult(await promise, input.limit, false);
}
