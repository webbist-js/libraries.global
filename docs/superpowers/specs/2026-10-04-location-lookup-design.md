# Location lookup in the Index editor

**Date:** 2026-10-04
**Status:** Approved design (layout A)
**Scope:** Step 2 ("Where is it?") of the Index editor wizard, `apps/ui/src/app/[locale]/contribute/index/_components/`. No Strapi schema or API changes beyond one filter on the relations proxy.

## 1. Problem

Step 2 is seven free-text fields. Contributors type a street, city, country and postcode by hand, then find coordinates in another tab ("Right-click in Google Maps → copy coordinates") and paste latitude and longitude into two boxes one at a time. Nothing checks the numbers. The Content hierarchy selects below ask for the continent and country again, by hand.

## 2. Outcome

A contributor types the library's name or address, picks a result, and the address, coordinates and atlas hierarchy fill themselves. A map pin shows where that is and can be dragged to the right building. Someone standing in the library can press "Use my location". Every field stays visible and editable underneath, so typing it all by hand still works when the lookup finds nothing.

## 3. Decisions

1. **Geocoder: Photon** (OpenStreetMap data, komoot's public instance at `photon.komoot.io`). It is built for search-as-you-type, which Nominatim's usage policy forbids, and OSM's ODbL licence lets us store the coordinates permanently with attribution. Mapbox's standard geocoding and Google Places both restrict storing results, and we save them on the record.
2. **Proxied through Next.** The browser never calls Photon. The proxy sets our User-Agent, caches, rate-limits per user, and keeps the contributor's IP away from a third party. `PHOTON_URL` (default `https://photon.komoot.io`) makes a self-hosted instance a config change.
3. **Layout A: search on top, fields always visible.** The fields are the manual fallback. No collapsed state, so improve mode, resumed drafts and validation errors need no special handling.
4. **Explicit actions overwrite, implicit ones don't.** Picking a search result writes what the result provides. A reverse lookup (from the pin or "Use my location") fills empty address fields, or else offers its address with a "Use this address" button.
5. **Delete the unused Nominatim helper.** `lib/geo-lookup.ts`, `hooks/useGeoLookup.ts` and `hooks/__tests__/useGeoLookup.test.ts` have no consumers and call Nominatim from the browser with a User-Agent header browsers drop.

## 4. Design

### 4.1 Geocoding proxy

Two route handlers under `apps/ui/src/app/api/geocode/`:

| Route                                | Input                                                | Photon call                            |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------- |
| `GET /api/geocode/search?q=`         | `q` trimmed, 3–200 characters                        | `/api/?q=…&limit=6&lang=en`            |
| `GET /api/geocode/reverse?lat=&lng=` | finite numbers, lat in [-90, 90], lng in [-180, 180] | `/reverse?lat=…&lon=…&lang=en&limit=1` |

- **Auth:** a signed-in session (the wizard already requires one). 401 without.
- **Rate limit:** per user via `lib/rate-limit.ts`: search 60 a minute, reverse 20 a minute. 429 with `Retry-After`.
- **Upstream:** `User-Agent: libraries.global (https://libraries.global; info@libraries.global)`, 5 s timeout, `next: { revalidate: 86400 }` so repeat queries come from the data cache. Reverse coordinates are rounded to 5 decimal places (about 1 m) before the call so nearby pins share cache entries.
- **Failure:** a Photon error or timeout returns 502 `{ error: "unavailable" }`. The client shows the "isn't available" state and the fields still work.
- **Output:** `{ data: Place[] }`, normalised server-side (§4.2). Photon's raw GeoJSON never reaches the client.

### 4.2 The `Place` shape

`apps/ui/src/lib/geocode/` holds the types and the pure normaliser, shared by both routes and tested on its own.

```ts
interface Place {
  id: string // `${osm_type}${osm_id}`, e.g. "W61300076"
  label: string // the name, or the street line when there's no name
  detail: string // "Haworth and Stanbury, Bradford, England, United Kingdom"
  kind: string // "Library", "Museum", "Street", "Town", "Address", …
  lat: number
  lng: number
  precise: boolean // a building or address, not a street, town or region
  address: {
    streetAddress: string
    district: string
    city: string
    postalCode: string
    country: string
    countryCode: string // ISO 3166-1 alpha-2, upper-case
    state: string
    county: string
  }
}
```

Mapping from Photon `properties`:

- **streetAddress:** `housenumber` and `street`, ordered for the country: number after the street for countries that write it that way (DE, AT, CH, NL, BE, IT, ES, PT, PL, CZ, SK, HU, SE, NO, DK, FI, IS, HR, SI, RS, RO, GR, TR, BR, AR, CL, MX and the rest of Latin America), number first otherwise. Just `street` when there's no number. Empty when there's no street.
- **city:** the result's own `name` when it is a settlement (`osm_key: place`, `osm_value` city, town, village or hamlet). Otherwise `city`, falling back to `locality`. Photon's `city` is the administrative district in some countries (Haworth's is "Bradford"), so a contributor can always correct it.
- **district:** `district`, unless it equals the city.
- **postalCode, country, state, county:** as given. `country` comes in English (`lang=en`).
- **kind:** a small map from `osm_value` (library, museum, archive, university, college, school, place-of-worship, house, street, settlements) to a label, otherwise the `osm_value` title-cased.
- **precise:** `type` is `house` or the feature has a `housenumber`.

### 4.3 Search box

`LocationLookup.tsx`, at the top of step 2, above the address fields.

- **Control:** a labelled input, "Find the library or its address", following the ARIA combobox pattern (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`). ↑/↓ move, Enter picks, Esc closes. A visually hidden `aria-live` line announces "6 results" or "No matches".
- **Requests:** 300 ms debounce, 3-character minimum, an `AbortController` cancels the previous request.
- **Prefill:** in new mode, when every location field is empty, the input starts with the library name from step 1. Results load on focus.
- **Rows:** the label in semibold `T.ink.base`, the detail line in `T.ink.dim`, the kind as a neutral badge.
- **Pick:** `applyPlace` (§4.6) writes the fields and coordinates, the map flies to the result, the list closes, and a status line reads "Filled from OpenStreetMap — check the details below."
- **Empty:** "No matches. Try the street and town, or enter the address below."
- **Error or 429:** "Search isn't available right now. Enter the address below."
- **Attribution** under the list: "Search by Photon · © OpenStreetMap contributors", both linked.

### 4.4 Use my location

A secondary pill button beside the search input.

- Calls `navigator.geolocation.getCurrentPosition` (high accuracy, 10 s timeout). `Permissions-Policy` already allows `geolocation=(self)`.
- Sets lat/lng (6 decimal places), moves the pin, then runs the reverse lookup with the fill rule (§4.6).
- Shows the reported accuracy. Above 200 m: "Your location is approximate. Drag the pin onto the building."
- Denied: "Location access is off. Search or drop a pin instead." Unavailable or timed out: "Couldn't get your location. Search or drop a pin instead."
- Hidden when `navigator.geolocation` doesn't exist.

### 4.5 Coordinates and map

**Coordinate fields** stay as two `Field`s with two additions:

- **Pasting a pair** ("51.5297, -0.1271", "51.5297 -0.1271", "(51.5297, -0.1271)") into either field fills both. The hint becomes "Paste “51.5297, -0.1271” from Google Maps into either box." `Field` gains an optional `onPaste`.
- **Range check:** step 2's validation also flags `lat` or `lng` when it holds something that isn't a number in range. Leaving the step forward or sending is refused, exactly as for a missing required field, and the field's error reads "Latitude is a number between -90 and 90" (or the longitude equivalent) instead of the required-field message. An empty coordinate is still allowed.

**`LocationPinMap.tsx`** sits under the coordinate fields.

- MapLibre loaded with `import("maplibre-gl")` like `LibraryHeroMap`, style CARTO Voyager **with** labels (`voyager-gl-style`), 280 px tall (220 px under `sm`), white card frame per the v2 tokens.
- A draggable `maplibregl.Marker` in `T.accent.primary`. Dragging it, or clicking the map, sets lat/lng (6 decimal places). After a drag or click, the reverse lookup runs with the fill rule.
- When lat/lng change from outside the map (typing, pasting, a search pick, geolocation), the map flies there: zoom 17 for a precise place, 14 otherwise.
- With no coordinates the map shows the whole world with an overlay: "Zoom in and click the map to drop a pin." Search and "Use my location" are the quicker routes, and the overlay says so.
- `cooperativeGestures: true`, so the page still scrolls on touch and with the wheel. No rotation or pitch.
- The map container has an accessible name and a description pointing to the coordinate fields as the keyboard way to set the point. No WebGL: the map is replaced by a one-line note, as `LibraryHeroMap` does.

### 4.6 Applying results

Pure functions in `location.apply.ts`, tested without React:

- `applyPlace(form, place)`: sets each of `streetAddress`, `district`, `city`, `postalCode`, `country` that the place has a non-empty value for, and always sets `lat`/`lng`. Fields the place lacks keep their current value.
- `addressIsEmpty(form)`: true when street, district, city, postcode and country are all blank.
- **Fill rule for reverse lookups:** when `addressIsEmpty`, apply the place's address (not its coordinates: the pin is where the contributor put it). Otherwise show "Nearest address: {label}, {city}" with a "Use this address" button that does the same. The offer disappears when the coordinates change again or a field is edited.
- `parseCoordinatePair(text)`: returns `{ lat, lng }` for the formats in §4.5 when both are in range, else null.
- `formatCoord(n)`: 6 decimal places, trailing zeros trimmed.

### 4.7 Atlas hierarchy

After a search pick or an applied reverse lookup:

1. **Country.** `GET /api/relations/countries?iso2=GB` (new filter on the existing route: `filters[iso2][$eqi]`, `populate[continent][fields][0]=documentId`) returns `{ documentId, name, continentDocumentId }`. If continent is empty, or the result is in a different country from the one selected, set continent and country and clear region and area (as the selects' own handlers do, including any Location Request proposal). If the same country is already selected, keep it.
2. **Region**, only while empty: fetch the country's regions (the existing list endpoint) and pick one whose name, normalised (case, accents, a leading "The", "County of"/"City of"), equals the place's `state`, `county`, `city` or `district`. Exactly one match is set; zero or several leave it empty.
3. **Area**, only while empty and a region is set: the same against the region's areas with `county`, `city`, `district`.
4. A status line under the hierarchy reads "Set from the address. Check these." until the contributor changes any of the four selects.

A failed lookup at any step leaves the hierarchy as it was.

### 4.8 Modes

- **New and improve:** identical behaviour. In improve mode the changed-field markers show what the lookup touched, and the summary lists it like any other edit.
- **Translation mode:** location fields are shared across languages, so the search, location button and map are not rendered. The read-only fields stay as they are.
- **Moderator panel:** reuses the hierarchy selector only, so it is unaffected.

## 5. Files

| File                                                               | Change                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `apps/ui/src/lib/geocode/place.ts`                                 | new: `Place` type, Photon normaliser, street ordering, kind labels |
| `apps/ui/src/lib/geocode/photon.ts`                                | new, `server-only`: Photon URL building and fetch                  |
| `apps/ui/src/app/api/geocode/search/route.ts`, `reverse/route.ts`  | new route handlers                                                 |
| `apps/ui/src/app/api/relations/[type]/route.ts`                    | `countries?iso2=` lookup                                           |
| `.../contribute/index/_components/location.apply.ts`               | new pure helpers (§4.6) and the region/area name matcher (§4.7)    |
| `.../contribute/index/_components/LocationLookup.tsx`              | new: combobox and "Use my location"                                |
| `.../contribute/index/_components/LocationPinMap.tsx`              | new: MapLibre pin map                                              |
| `.../contribute/index/_components/WizardSteps.tsx`                 | step 2 composes the above; coordinate paste and hint               |
| `.../contribute/index/_components/WizardFields.tsx`                | `Field` gains `onPaste`                                            |
| `.../contribute/index/_components/wizard.validation.ts`            | coordinate range errors on step 2                                  |
| `apps/ui/src/lib/geo-lookup.ts`, `hooks/useGeoLookup.ts`, its test | deleted                                                            |
| `apps/ui/.env.local.example`                                       | `PHOTON_URL` documented                                            |
| `qa/tests/playwright/e2e/access/location-lookup.spec.ts`           | new E2E (§6)                                                       |

## 6. Testing

- **Vitest:**
  - the normaliser against recorded Photon fixtures (a library with a house number in Germany, a UK museum without one, a village, a street, a reverse result with no street)
  - street ordering
  - `parseCoordinatePair` (formats, ranges, junk)
  - `applyPlace` and the fill rule
  - the region/area matcher (exact, accented, ambiguous, none)
  - both route handlers: 401, 400 on bad input, 429, 502 on upstream failure, the Photon URL they build
  - the `iso2` relations filter
  - coordinate range validation
- **Playwright:** `e2e/access/location-lookup.spec.ts` in the `access` project, alongside `location-request.spec.ts`, since the wizard needs a signed-in fixture user. With `/api/geocode/*` intercepted:
  - type a name, pick a result, and check the address fields, the coordinate values and the continent and country selects
  - paste a pair into latitude and check both fields
  - enter an out-of-range latitude and check that Next is refused with the range message

## 7. Out of scope

- The Strapi admin `location-picker` custom field keeps its own Nominatim search.
- The correction drawer's address editor (`CorrectionEditor`) doesn't edit coordinates; it can adopt `LocationLookup` later.
- Self-hosting Photon. Revisit if the public instance throttles us or volume grows with bulk contribution.
- **Privacy policy wording.** It may want a line naming Photon (komoot) as a geocoding provider. The legal documents are final copy, so the owner decides; this work doesn't edit them.
