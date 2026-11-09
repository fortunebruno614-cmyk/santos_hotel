# Flight tracking (OpenSky Network)

The public `/flights` page shows live aircraft around the hotel and lets guests
search the global live feed by callsign or flight number. It is an additive
feature: booking, admin, authentication and the existing room map are untouched.

## Architecture

```
Browser (/flights)
  └─ GET /api/public/flights?scope=world | ?bbox=... | ?callsign=...
       └─ src/app/api/public/flights/route.ts   (public, rate-limited, no secrets)
            └─ src/server/flights/opensky.ts
                 ├─ OAuth2 client-credentials token (cached, auto-refresh)
                 ├─ GET https://opensky-network.org/api/states/all
                 └─ in-memory token + response cache (globalThis)
```

The browser never sees `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` or the
bearer token. Only the server calls OpenSky, and only public aircraft fields
are returned.

## OAuth2 / token management

- Token endpoint:
  `https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token`
- Grant: `client_credentials` (form-encoded id + secret).
- Tokens last ~30 minutes; the manager refreshes 60 seconds early.
- One in-flight token request is shared by concurrent callers.
- A `401` from `/states/all` invalidates the token and retries exactly once.
- The token is stored on `globalThis` so dev hot-reloads do not mint a new token
  every request.
- Credentials and tokens are never logged, returned, or embedded in HTML.

## Configuration

Add to `.env.local` (git-ignored; never commit real secrets):

```env
OPENSKY_CLIENT_ID=...
OPENSKY_CLIENT_SECRET=...
```

Optional tuning:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `OPENSKY_CACHE_TTL_SECONDS` | `120` | Reuse the last upstream response (credit guard) |
| `FLIGHT_BBOX_SPAN_DEG` | `4` | Default map region around the hotel |
| `FLIGHT_DEFAULT_LAT` / `LON` | `6.426588` / `3.429399` | Centre when the hotel has no coordinates |
| `FLIGHT_DEFAULT_ZOOM` | `6` | Initial regional map zoom |
| `FLIGHT_MAX_AIRCRAFT` | `250` | Server result cap |
| `OPENSKY_MAX_BBOX_AREA` | `400` | Largest bbox (sq°) the public route accepts |
| `OPENSKY_TIMEOUT_MS` | `12000` | Upstream request timeout |

The browser only ever talks to `/api/public/flights`; there is no
`NEXT_PUBLIC_OPENSKY_*` variable.

## Search behaviour

OpenSky's live API has no flight-number search endpoint, so the backend fetches
the `states/all` feed and ranks callsigns:

1. exact callsign (`BAW117`)
2. callsign prefix (`BAW`)
3. query longer than callsign
4. IATA-to-ICAO heuristic: same trailing flight number and first letter
   (`BA117` → `BAW117`)
5. numeric suffix only (`117`)
6. substring (`W11`)

Regional browsing keeps a bounding box around the hotel. A callsign search
queries the global feed and fits the map to the matches. The page defaults to
the worldwide map (always populated) with a one-click "Near hotel" scope.

## Credits and abuse protection

OpenSky charges credits per `/states/all` request (1–4 depending on bbox area)
with a daily quota. The integration:

- caches responses for 120 seconds (shared across all visitors);
- caches the OAuth token until shortly before expiry;
- default worldwide view uses 4 credits; the hotel bbox uses ~2;
- rejects bboxes above `OPENSKY_MAX_BBOX_AREA`;
- rate-limits the public route to 30 requests/minute/IP;
- pauses auto-refresh while the tab is hidden and refreshes once every 2 minutes.

The worldwide default (4 credits / 120 s cache) stays under the standard
4,000-credit daily quota for a continuously-open tab (~2,880 credits/day).
`creditsRemaining` from OpenSky's `X-Rate-Limit-Remaining` header is returned in
the JSON for monitoring, but nothing sensitive is exposed.

## Data and attribution

The UI credits OpenSky Network and links to `opensky-network.org`. Review
OpenSky's current terms for commercial/production use; their documented API is
research-oriented and may require a licence for operational use.

## Files

- `src/app/(site)/flights/page.tsx` — public page + metadata
- `src/components/flights/flight-tracker.tsx` — search, status, list, details
- `src/components/flights/flight-map.tsx` — Google Maps aircraft markers
- `src/app/api/public/flights/route.ts` — credential-free public proxy
- `src/server/flights/opensky.ts` — OAuth token manager, upstream client, cache
- `src/server/flights/state.ts` — state-vector parsing and callsign ranking
- `src/server/flights/validation.ts` — bbox/callsign/limit validation
- `src/server/flights/rate-limit.ts` — per-IP request throttle
- `src/config/flights.ts` — server-only config/env

## Testing

```bash
npm run typecheck
npm test
npm run lint
```

Unit tests cover state-vector parsing, callsign ranking, bbox validation and
query normalisation. With the dev server running and credentials configured:

```bash
curl "http://localhost:3000/api/public/flights?scope=world&limit=10"
curl "http://localhost:3000/api/public/flights?bbox=2.4,1.4,10.4,5.4&limit=10"
curl "http://localhost:3000/api/public/flights?callsign=BAW117"
```
