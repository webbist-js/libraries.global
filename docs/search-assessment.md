# Search Integration Assessment

**Date:** 2026-05-07
**Scope:** Library index and Events index — MeiliSearch integration, search capability, geo-lookup, and geolocation gaps.

---

## 1. Library Index

### 1.1 How it works today

Search is powered by MeiliSearch (`library` index). The client calls `searchLibraries()` directly from the browser using the public search key. The SSR page fetch also calls `searchLibraries` once on the server to pre-populate results before hydration.

**Indexed searchable fields** (`searchableAttributes` in `apps/strapi/config/plugins.ts`):

- `name`, `shortName`, `summary`, `city`, `district`
- `country_name`, `region_name` (flattened from relations via `transformEntry`)

**Filterable fields:**

- `libraryType`, `operationalStatus`, `continent_slug`, `country_slug`, `region_slug`, `featured`
- `accessibility_names`, `service_names` (flattened arrays)
- `operatorType`

**Sortable fields:** `name`, `featured`

**Geo support:** `_geo: { lat, lng }` is written by `transformEntry` when the library has a valid location. `searchNearbyLibraries()` uses `_geoRadius` and `_geoPoint` sort — this works for "nearby libraries" on detail pages but is **not exposed on the index page**.

---

### 1.2 Bugs fixed in this session

| Bug                                      | Root cause                                                                                                                                                                | Fix                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "No results" count despite cards showing | MeiliSearch returns `totalHits` (not `estimatedTotalHits`) when using `page`+`hitsPerPage` pagination mode. `estimatedTotalHits` is only set when using `offset`+`limit`. | Use `result.totalHits ?? result.estimatedTotalHits ?? 0` in both `LibraryIndexGrid.tsx` and the SSR page fetch. |
| "No results" flash on initial load       | `useState(!initialHits)` evaluates `![]` as `false`, so loading starts `false` when SSR returns 0 hits, immediately rendering "No results" before the client fetch runs.  | `useState(!initialHits \|\| initialHits.length === 0)`                                                          |

---

### 1.3 What works

| Capability                                                        | Status                         |
| ----------------------------------------------------------------- | ------------------------------ |
| Full-text search by library name                                  | Works                          |
| Full-text search by city / district                               | Works                          |
| Full-text search by country or region name                        | Works                          |
| Filter by continent / country / region (dropdown)                 | Works                          |
| Filter by library type, status, operator, accessibility, services | Works                          |
| Sort by name A-Z / Z-A / Pillar first                             | Works                          |
| Nearby libraries on detail page (geo radius)                      | Works                          |
| Pagination                                                        | Works — fixed `totalHits` read |

---

### 1.4 Gaps

#### A. Text query does not drive geo filters

**Current behaviour:** Typing "Leeds" in the search box performs a full-text MeiliSearch query. If Leeds libraries match on `city` or `region_name`, they appear in results — but the continent/country/region dropdowns remain blank.

**Expected behaviour:** Typing a place name should also resolve to the correct geographic scope and pre-populate the dropdowns (e.g. continent=`europe`, country=`gb`, region=`west-yorkshire`).

**What is needed:**

1. A geo-lookup step before or alongside the MeiliSearch query. Options:
   - Call a geocoding API (Nominatim/OpenStreetMap is free; Google Maps Geocoding or Mapbox are alternatives) with the query string.
   - If the geocoder returns a city/country match, map that to our slug taxonomy and set `continentSlug`/`countrySlug`/`regionSlug` in filter state.
   - Run this lookup with debounce (~400 ms) whenever the search input changes.
2. The mapping from geocoder country codes → our `country_slug` values needs a lookup table (or the geocoder can return ISO2 codes which we already have in `COUNTRIES`).
3. If no geo match is found, fall through to plain text search.

**Rough implementation path:**

```
searchInput onChange
  → debounce 400ms
  → tryGeoLookup(query)      // calls Nominatim or similar
      → resolveToSlugs()     // ISO2 → country_slug via COUNTRIES table
      → if match: setFilters({ ...filters, continentSlug, countrySlug, regionSlug })
  → always: setFilters({ ...filters, query })  // also run text search
```

#### B. Street address not searchable

`address` and street-level fields are not in `searchableAttributes`. Adding them to the Strapi plugin config and re-indexing would enable address search. Low-priority given most users search by name or city.

#### C. Browser geolocation not used

The `_geo` field and `_geoRadius` filter are fully supported in MeiliSearch, and `searchNearbyLibraries()` already works. But the index page has no "Near me" trigger.

**What is needed:**

1. A "Near me" button in the geo filter bar that calls `navigator.geolocation.getCurrentPosition()`.
2. On success, call `searchLibraries` with a `_geoRadius` filter centred on the user's coordinates (e.g. 50 km radius initially, with a range control).
3. Sort results by `_geoPoint` distance.
4. The existing `searchNearbyLibraries()` function can be adapted for this; the main `searchLibraries()` function would need an optional `nearLat`/`nearLng`/`radiusMeters` parameter added.

#### D. `street` / `postcode` not in MeiliSearch index

No `address` component is in the library schema's indexed fields. Adding `address` (if it exists as a field) or decomposed `street`, `postcode` fields to `searchableAttributes` in `plugins.ts` would cover street-level search.

---

## 2. Events Index

### 2.1 How it works today

Events do **not** use MeiliSearch. The `EventCardGrid` component fetches from a Strapi REST endpoint:

```
GET /api/events/global?from=…&to=…&limit=20&page=1&type=…&isFree=…
```

This endpoint is proxied through `/api/public-proxy/api/events/global` in the Next.js layer.

**Search within results** (`filters.search`) is performed entirely client-side after the API response is received, using `toLowerCase().includes()` matching against `event.title` and `event.libraryName`. This only searches the current page of results — it cannot find events on other pages.

**Location filtering** is passed as `countryCode` and `regionSlug` URL params to the Strapi API, which filters at the database level. These are driven by dropdowns in `EventsSidebar`, not by text input.

---

### 2.2 Gaps

#### A. No MeiliSearch index for events

The events plugin (`apps/strapi/src/plugins/events`) is registered in `config/plugins.ts` but has no MeiliSearch configuration block — unlike `library`, `blog-article`, and `wiki-article`.

**Impact:**

- No full-text search across all events (only current-page client-side match)
- No searchable `libraryName`, `city`, `countryCode` fields
- No geo-radius search by library location
- Pagination breaks search (results on page 2+ are invisible to the search box)

**What is needed to add MeiliSearch to events:**

1. Add an `event` block to `meilisearch.config` in `apps/strapi/config/plugins.ts`:

```ts
event: {
  settings: {
    searchableAttributes: ["title", "description", "libraryName", "city", "country_name"],
    filterableAttributes: ["startTime", "eventType", "isFree", "countryCode", "region_slug", "library_slug"],
    sortableAttributes: ["startTime"],
  },
  transformEntry({ entry }) {
    const library = entry.library as Record<string, unknown> | null
    return {
      ...entry,
      libraryName: library?.name ?? null,
      city: library?.city ?? null,
      country_name: library?.country_name ?? null,   // already flattened on library
      region_slug: library?.region_slug ?? null,
      library_slug: library?.slug ?? null,
      continent_slug: library?.continent_slug ?? null,
    }
  },
},
```

2. Add a `searchEvents()` function to `apps/ui/src/lib/meilisearch.ts` analogous to `searchLibraries()`.

3. Replace the client-side `applyClientFilters` search in `EventCardGrid` with a MeiliSearch call.

4. Replace the Strapi REST pagination in `EventCardGrid` with MeiliSearch pagination.

#### B. Text input does not drive geo filters (same gap as library index)

Typing "Leeds" in the events search box should resolve to `countryCode=GB`, `region_slug=west-yorkshire` and filter events at libraries in that area. Requires the same geo-lookup step described in §1.4A.

#### C. No browser geolocation on events index

Same gap as §1.4C. Events could surface "Events near me" using the library's `_geo` field (after events are indexed in MeiliSearch and the library's geo data is denormalised into the event record via `transformEntry`).

---

## 3. Priority Summary

| #   | Item                                           | Effort | Impact                                           |
| --- | ---------------------------------------------- | ------ | ------------------------------------------------ |
| 1   | Fix `totalHits` / "No results" count bug       | Done   | High — broken UX                                 |
| 2   | Fix loading flash on empty SSR                 | Done   | Medium                                           |
| 3   | Add MeiliSearch index for events               | Medium | High — search is broken for events beyond page 1 |
| 4   | Geo-lookup from text input (library index)     | Medium | High — "Leeds" → Leeds results                   |
| 5   | Geo-lookup from text input (events index)      | Medium | High — after events MeiliSearch                  |
| 6   | "Near me" geolocation button (library index)   | Small  | Medium — nice-to-have                            |
| 7   | "Near me" geolocation button (events index)    | Small  | Medium — after events MeiliSearch                |
| 8   | Index `street` / `postcode` / `address` fields | Small  | Low                                              |

---

## 4. Recommended Next Steps

1. **Events MeiliSearch index** — highest leverage: fixes pagination-broken search, unlocks geo filtering, enables "near me".
2. **Geo-lookup on text input** — implement for library index first (smaller scope), then reuse for events. Use Nominatim (free, no API key) as the geocoder; fall back to plain text if no geo match.
3. **"Near me" button** — small addition once geo infrastructure is in place.
