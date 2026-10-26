# MRD: Google Maps Hotel Map-and-List View

**Product:** Santo Hotel booking website  
**Status:** Proposed  
**Audience:** Product, design, frontend, backend, QA  
**Scope:** Public room catalogue and date-based availability results

## 1. Executive summary

Add an optional map-and-list presentation to room discovery. On desktop, guests see room results in one pane and an interactive Google Map in the other. On smaller screens, guests can switch between the room list and map without losing their dates, filters, sort order, or selected room.

Santo Hotel is currently a single-property booking application. Therefore, the map represents the **hotel's location**, while the list represents the hotel's room types or available room results. Do not imply that different room types are in different locations or create separate room-location markers.

## 2. Problem and opportunity

Guests can browse room descriptions, amenities, and prices, but cannot easily understand where the property is. A map alongside the room list will make the hotel's location visible during room discovery, let guests inspect nearby context, and support a more confident booking decision without interrupting the existing search and booking flow.

## 3. Product goals

1. Show the Santo Hotel's verified geographic location next to the rooms that guests can browse or book.
2. Let guests move between list and map while preserving their current search and filters.
3. Make the view useful on desktop and mobile, including when Google Maps cannot load.
4. Keep room availability, pricing, currency, and booking decisions consistent with the existing backend.
5. Provide a clear, accessible route from a room result to its details and booking flow.

### Success measures

- Guests can identify the hotel's location without leaving room discovery.
- Map/list toggling does not clear search parameters, filters, sort, or current results.
- Map interactions never change or bypass authoritative availability and pricing checks.
- Map failures leave room discovery and booking usable.

## 4. Users and key scenario

**Primary user:** A prospective guest comparing room types and rates before booking.

**Scenario:** A guest searches available rooms for selected dates, reviews the room cards, checks the property's location on the map, and opens a room or proceeds to booking. They may switch display currency between NGN and USD; the map must not alter that preference or the backend booking currency.

## 5. Scope

### In scope

- A map/list mode for the public `/rooms` catalogue and date-based availability results, reusing the existing listing and search behavior.
- One Google Map centered on the Santo Hotel.
- One hotel marker with a concise property information card.
- Existing room result cards in a dedicated list pane.
- Bidirectional visual selection between the selected result and its corresponding map representation where appropriate.
- Responsive layout, map loading/error/empty states, keyboard access, and reduced-motion support.
- Google Maps API configuration and location-data requirements.

### Out of scope

- A multi-hotel marketplace or multiple property markers.
- Showing individual guest rooms as geographically distinct pins.
- Directions, routing, transit, geolocation, or continuous user-location tracking.
- Changing room availability, price calculation, booking, payment, or cancellation rules.
- Replacing the existing list-only experience or removing existing filters.

## 6. Product requirements

### MR-01: Entering and leaving map view

- Provide an obvious **List / Map** control on room discovery pages.
- Preserve the current route, date/guest query parameters, currency selection, room filters, and sort order when changing views.
- Keep the existing list-only behavior available, including if the Maps API is unavailable or disabled.
- Ensure the selected mode is understandable and announced to assistive technology.

### MR-02: Desktop split view

- Use a two-pane layout at desktop widths: results list on the **left** and map on the **right**.
- Allocate approximately 45–50% of the available content width to the list and the remainder to the map; allow a minimum usable width for both.
- Keep the map visible while the guest scrolls the result list. The page header and search controls remain above the split view.
- Keep filters and sorting available without obscuring the map or making the result pane unusably narrow.
- Give the map a stable, useful height based on the viewport; avoid a small inline map that requires scrolling past the results to use.

### MR-03: Mobile and tablet behavior

- Do not squeeze list and map side-by-side at phone widths.
- Use a clear segmented **List / Map** switch, or an equivalent accessible toggle, to show one full-width view at a time.
- Preserve list scroll position and current selection when returning from the map.
- Keep the map controls and hotel marker usable without overlapping the mobile header, sticky controls, or safe areas.
- Reflow tablet layouts at a deliberate breakpoint rather than relying on accidental overflow.

### MR-04: Hotel marker and map content

- Display one marker for the hotel, using verified latitude/longitude when available.
- Selecting the marker opens a compact, accessible information card showing the hotel name, address (when available), and a link to the hotel/property information page.
- The map opens centered on the hotel at a neighborhood/city-level zoom appropriate to the accuracy of the stored location. Do not zoom in farther than the coordinate's precision supports.
- Include standard Google Map controls and Google-required attribution/branding. Do not cover attribution with custom controls.
- Do not show fabricated nearby attractions, distances, neighborhood claims, or directions.
- Room result cards describe accommodation at the same hotel; they must not be represented as separate map locations.

### MR-05: Room list and selection

- Retain the existing room cards, room details links, booking actions, filters, sort order, availability messaging, and policy notes.
- The result count and empty state must describe the currently filtered result set.
- A selected room card must have a visible selected/focused state. If the map uses a property card, make clear that it represents the shared hotel location, not a unique location for that room.
- Selecting a room card must not falsely move the hotel marker to another location.
- Room links must preserve applicable stay parameters. Booking must continue through the existing booking flow and server-side validation.

### MR-06: Search, price, and currency consistency

- Keep current check-in/check-out, guest count, and room quantity visible and editable through the existing search controls.
- Do not replace the backend's date-specific availability or price calculations with map-side data.
- Continue displaying prices through the shared currency formatting behavior and current NGN/USD preference.
- The map must not convert, persist, or modify any monetary amount.
- Changing map/list mode must not submit a booking or modify the URL in a way that loses the guest's search.

### MR-07: Location data and API configuration

- The current hotel record has address fields but no latitude/longitude fields. Add a versioned database migration and typed data path for hotel coordinates before enabling a precise marker.
- Coordinates must be set from a verified hotel location by an authorized operator or a verified geocoding workflow. Never guess coordinates or silently geocode an ambiguous address in production.
- If coordinates are not configured, show an explicit “Map location unavailable” state with the available address; do not place a misleading pin.
- Configure the Google Maps key through a server/deployment environment setting (for example, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only if the chosen Maps SDK requires a browser-visible key). Restrict browser keys by allowed website referrers and enable only the required Google Maps APIs.
- Do not commit API keys, include them in logs, or expose server-only credentials to the browser.
- Document key setup, allowed referrers, API restrictions, billing ownership, quota monitoring, and rotation in setup/deployment documentation before release.
- Follow Google Maps Platform terms, attribution, caching, and map-content requirements.

### MR-08: Loading, empty, and error states

- Show a restrained loading placeholder with the map pane's final dimensions to prevent layout shift.
- On Maps API load failure, show a clear non-blocking message and retain the room list and booking actions.
- On missing coordinates, use a distinct location-unavailable state; do not present it as an API outage.
- On zero results, keep the hotel map visible if the location is configured and show the existing empty-result guidance in the list pane.
- Do not swallow errors silently. Capture useful diagnostics without logging API keys or personal guest data.

## 7. UI and interaction direction

### Desktop composition

1. Keep the existing site header, breadcrumbs, page heading, and search panel.
2. Place the view toggle and result count/sort controls immediately before the split content.
3. Put the existing filters and vertically scrollable room results in the left pane.
4. Put the sticky Google Map in the right pane, with the single hotel marker and a compact property card.
5. Give the selected room card an unmistakable but restrained state that fits the existing Santo visual language.

### Mobile composition

1. Keep search controls and the List/Map toggle reachable near the top of results.
2. Show either the room list or a full-width map at a time.
3. Keep the map property card dismissible and ensure the marker can be selected by touch.
4. On returning to the list, restore the guest's previous scroll position and filters.

### Visual quality bar

- Reuse the current typography, spacing, button, border, and color tokens. The map should feel integrated with Santo's existing warm, considered hotel identity rather than like a separate application.
- Keep map styling subtle and readable; preserve standard Google attribution and map legibility.
- Prioritize clear room names, images, nightly price, capacity, and primary actions in the list.
- Use consistent selected, hover, focus, disabled, loading, and error states.
- Avoid excessive shadows, stacked floating controls, or decorative overlays that reduce map usability.

## 8. Accessibility and quality requirements

- Meet WCAG 2.2 AA for text contrast, focus visibility, control labels, and keyboard operation.
- All view-switching and map controls must be operable with keyboard and touch; controls must have accessible names and state.
- Do not rely on color alone to show selection.
- Respect `prefers-reduced-motion`; map transitions must not be required to understand a state change.
- Provide a textual hotel name/address and list interaction so core information is not map-only.
- Validate layout at phone, tablet, laptop, and large desktop widths, including browser zoom and long hotel/address text.

## 9. Dependencies and decisions required before implementation

1. Confirm and record the hotel's precise latitude/longitude and who is authorized to update it.
2. Provision and restrict a Google Maps Platform project/key; confirm billing, quota, and production referrers.
3. Confirm final desktop split ratio and mobile toggle design with product/design review.
4. Confirm whether the list/map selection should remain transient in page state or be shareable in the URL. Default: transient state; search parameters remain shareable and unchanged.

## 10. Acceptance criteria

- [ ] A guest can switch between list and map on `/rooms` and date-based availability results without losing search, currency, filters, sort, scroll position, or selection.
- [ ] Desktop shows the room list on one side and a persistent map on the other, with neither pane clipped at supported desktop widths.
- [ ] Mobile uses a usable list/map switch and never forces a cramped two-column layout.
- [ ] With verified coordinates and a valid API key, the map opens on the hotel and shows exactly one hotel location marker.
- [ ] Room types are not shown as different geographic locations.
- [ ] Selecting the hotel marker exposes the hotel's name and available address; no unverified nearby-place or distance claim is shown.
- [ ] Missing coordinates and Maps API failures produce distinct, useful states while room browsing and booking remain available.
- [ ] Existing filters, sorting, empty states, room details, and booking paths continue to work.
- [ ] Price display follows the current NGN/USD preference, and map interactions do not change pricing or booking behavior.
- [ ] Keyboard, screen-reader, touch, and reduced-motion checks pass.
- [ ] Automated tests cover state preservation, error/missing-location behavior, and list/map interaction; manual visual checks cover responsive breakpoints.

## 11. Implementation handoff

Use the existing room listing as the integration point: [`src/components/hotel/listing.tsx`](../src/components/hotel/listing.tsx), rendered by [`src/app/(site)/rooms/page.tsx`](../src/app/(site)/rooms/page.tsx) and the availability route. Reuse the current room cards and search state; do not create a parallel pricing or availability implementation.

Before shipping, update the hotel schema and Prisma migration for verified coordinates, wire coordinates through the public hotel profile, add restricted environment-based Maps configuration, and document local/deployment setup. Keep the map component isolated from booking authority: the server remains responsible for availability, quote totals, and booking validation.
