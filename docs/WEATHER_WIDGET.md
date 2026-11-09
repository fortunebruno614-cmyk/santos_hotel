# Weather widget

The public site header and the signed-in guest dashboard (`/account`, Overview
tab) show live weather for the default hotel using [Open-Meteo](https://open-meteo.com/).
Open-Meteo is keyless, so there is no credential to protect; the browser still
talks only to our cached proxy.

## Flow

```
Header chip + account card (client)
  └─ GET /api/public/weather
       └─ src/server/weather/open-meteo.ts
            ├─ resolves the default hotel server-side (never client coordinates)
            ├─ GET api.open-meteo.com/v1/forecast
            └─ 15-minute in-memory cache + stale-on-error fallback
```

## UX

- **Header** — compact chip with a condition icon and temperature. On narrow
  screens the condition label is hidden; at very small widths the chip hides
  entirely. A failed weather request renders nothing in the header.
- **Account dashboard** — richer card with current temperature, feels-like,
  humidity, wind, rain, a 4-day outlook, last-updated time, and an Open-Meteo
  attribution link. Failures show a retry state without affecting the rest of
  the dashboard.
- Both widgets share one client-side promise/cache, so opening the dashboard
  after the header does not trigger a second request.

## Configuration

Optional server-side overrides:

```env
WEATHER_ENABLED=true
WEATHER_CACHE_TTL_SECONDS=900
WEATHER_TIMEOUT_MS=8000
WEATHER_DEFAULT_LAT=6.426588
WEATHER_DEFAULT_LON=3.429399
```

The hotel's verified `latitude`/`longitude` are used when present; the defaults
are a documented Lagos fallback. `WEATHER_ENABLED=false` hides the widget and
returns 503 from the route.

## Files

- `src/config/weather.ts` — env configuration
- `src/lib/weather.ts` — shared types, WMO condition mapping, formatting
- `src/server/weather/open-meteo.ts` — upstream client, parser, cache
- `src/app/api/public/weather/route.ts` — public cached proxy
- `src/components/weather/weather-icon.tsx` — WMO → Lucide icon
- `src/components/weather/weather-widget.tsx` — header chip + dashboard card
- `tests/weather/weather.test.ts` — mapping/parsing tests

## Testing

```bash
node --import tsx --test tests/weather/weather.test.ts
npm run typecheck
npm test
npm run build
```

The live proxy was verified against Open-Meteo and the header chip/dashboard
card were rendered in headless Chrome at desktop (1440 px) and mobile (390 px)
widths with no overflow or runtime errors.
