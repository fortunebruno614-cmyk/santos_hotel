/**
 * Google Maps configuration for the public room map (MR-08 security).
 *
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 *       Browser key for the Maps JavaScript API, restricted to this site's
 *       HTTP referrers in Google Cloud. When unset the list/map toggle is
 *       hidden entirely and the listing keeps its list-only behaviour — no
 *       error is shown to guests and nothing is logged. The key is never
 *       written to logs or embedded anywhere except the loader URL.
 */

/** Trimmed key, or null when the map feature is disabled on this deploy. */
export function googleMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
}

/** Whether the List/Map toggle should be offered at all. */
export function isMapEnabled(): boolean {
  return googleMapsApiKey() !== null;
}

/** Whether to label the current map position as a local-only demo point. */
export function isDemoMapLocation(): boolean {
  return process.env.NEXT_PUBLIC_MAP_DEMO_LOCATION === "true";
}
