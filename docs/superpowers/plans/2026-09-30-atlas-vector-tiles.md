# Atlas at 3 million libraries: vector tiles plan

**Status:** proposed, 2026-09-30. Nothing built yet.
**Why now:** there are about 2.9 million libraries in the world. The Atlas can't carry that many today, and it is the only part of the platform that can't.

## The problem

`AtlasExplorer` loads every published library once, from `GET /api/libraries/atlas`, and does all its work in the browser: clustering, filters, filter counts, "loosen" suggestions, the in-view count, the list view, the search tab, deep links (`all.find(slug)`) and the ids that export sends.

Strapi builds that response by walking the whole library table with three many-to-many joins, and keeps it in process memory for five minutes (`utils/atlas-cache.ts`). Any library write clears the cache.

The measured payload is 625 bytes per library (107 libraries, 67 KB). At 2.9 million libraries:

| | Today (107) | At 2.9M |
| --- | --- | --- |
| Atlas JSON | 67 KB | ~1.8 GB (~300 MB gzipped) |
| Strapi build | instant | ~2,900 batched queries, minutes, GBs of heap |
| Browser | fine | can't parse it; the tab crashes |

Location pages have the same problem at a smaller scale. `InteractiveMap` reads `/libraries/map-pins`, which stops at 500 pins and sets `truncated`. At 2.9M, most large regions will have more than 500 libraries.

## The idea

Split the Atlas's two jobs:

1. **Drawing the map** comes from static vector tiles: one PMTiles archive, rebuilt on a schedule and served from object storage over a CDN. The browser only downloads the tiles on screen.
2. **Answering questions** (how many match, what's in view, search, suggestions, export) goes to Meilisearch. It already indexes every library with `_geo` and the main filters.

Strapi stays the source of truth and stops serving bulk map data. Detail comes from the existing library endpoints when someone opens a pin.

```
Strapi ──(keyset export, nightly + on change)──▶ tile build (tippecanoe) ──▶ atlas.pmtiles on R2/S3 + CDN
   │                                                                                 │
   └──(existing plugin sync)──▶ Meilisearch `library` index                         ▼
                                   ▲                                       MapLibre (pmtiles://)
                                   └──────── viewport + filter queries ◀── AtlasExplorer
```

## Design

### 1. Tile archive

- **Build:** a script, `apps/strapi/scripts/build-atlas-tiles.mjs`, streams libraries from a new bridge-secret-gated keyset endpoint (`GET /libraries/tile-source?after=<id>`, 1,000 per page, the same pattern as `/libraries/slugs`). It writes NDJSON GeoJSON and runs `tippecanoe` to produce `atlas.pmtiles`, then uploads the result under a versioned key (`atlas-<buildId>.pmtiles`). Last, it updates a small `atlas-tiles.json` manifest (`{ url, builtAt, count }`). The manifest is served with a short cache time; the archive is immutable, so it can be cached for good.
- **Where it runs:** a scheduled GitHub Action (nightly), which can also be triggered by `repository_dispatch`. `tippecanoe` is a native binary, so it can't run on Vercel functions. The sync worker could host it instead if it ends up in a container.
- **tippecanoe settings:** zoom 0–14. `--cluster-distance` and `--accumulate-attribute` produce pre-built clusters with a `point_count` at low zoom. `-r1 --drop-densest-as-needed` is off from z10 up, so every library is in the tiles at street level. Keep tiles under about 500 KB.
- **Feature properties** (short keys, so tiles stay small):

| Key | Meaning | Used by |
| --- | --- | --- |
| `i` | documentId | pin click, "recent changes" masking |
| `s` | slug | deep links |
| `t` | type group (`TYPE_GROUPS`) | type filter, pin style |
| `o` | operator group | operator filter |
| `st` | operational status | closures layer, `isListed` |
| `f` | facility codes, comma-wrapped (`,wc,lp,`) | facilities filter via `["in", ",wc,", ["get","f"]]` |
| `e` / `c` | has events / catalogue | filters, events layer |
| `y` | founded year | founded filter, Pro founded layer |
| `p` | completeness | completeness layer |
| `h` | open week-slots string (see below) | open now / open at, open-late layer |

- **Opening hours:** MapLibre expressions can't evaluate hours in each library's timezone. The build therefore precomputes a 336-character `0`/`1` string for each library: the 30-minute slots of the week in UTC, using this week's UTC offsets. The browser works out the current UTC slot `n` and filters with `["==", ["slice", ["get","h"], n, n + 1], "1"]`. The nightly rebuild keeps DST changes correct. It's about 336 bytes per feature before compression and compresses very well. If tiles run too large, drop it below z10 and send low-zoom "open now" to Meilisearch (§2).

### 2. Meilisearch for everything that counts

Add these fields to the `library` index's `transformEntry` and make them filterable: `type_group`, `operator_group`, `has_events`, `has_catalogue`, `founded`, `completeness`, `open_slots` (an array of UTC slot numbers), and three grid cells `cell_3`, `cell_4`, `cell_5` (geohash prefixes).

| Atlas feature | Today | After |
| --- | --- | --- |
| Filter counts, `countWith`, `loosenSuggestions` | loops over all libraries | one Meili `multiSearch`: the base query plus one query per suggestion, `limit: 0`, with `_geoBoundingBox` |
| "N libraries in view", `groupsInView`, `places` | filter over all | Meili with `_geoBoundingBox` and `facets` |
| List view | sorts the in-view set | paged Meili query, `sort: ["_geoPoint(lat,lng):asc"]` |
| Search tab | client-side fuzzy match | the existing `/api/search/libraries` |
| Filtered clusters at low zoom | Supercluster over filtered GeoJSON | Meili facet distribution over `cell_<z>` for the viewport; draw one circle per cell at its centre |
| Open now / open at | `isOpenAt` in the browser | `open_slots = n` |

Low-zoom pre-built clusters can't reflect filters. So with **no filters**, clusters come from the tiles. With **filters on, below z10**, the tile cluster layer is hidden and the Meili cell layer is shown instead. From z10 up, every point is in the tiles, and MapLibre filter expressions handle it.

### 3. Freshness

- A library approved or edited today shows up in search, lists and counts at once, because Meili syncs on write.
- The map tiles lag until the next build. To cover the gap, add `GET /libraries/atlas-changes?since=<builtAt>`, which returns the few libraries changed since the build (hard-capped, for example at 2,000). The browser draws them from a small GeoJSON source, and hides their stale copies in the tiles with `["!", ["in", ["get","i"], ["literal", changedIds]]]`.
- A Strapi `afterUpdate` hook can send a debounced `repository_dispatch` (at most one build every 30 minutes) so the lag stays short on busy days.

### 4. Pins, deep links and export

- **Pin panel and deep links** (`?library=<slug>`) fetch one library by slug. No more `all.find`.
- **Export** posts `{ format, filters, bbox }` instead of ids. `/api/export/atlas` runs the same Meili query server-side for up to `limits.exportRows` ids, then calls the existing Strapi `POST /api/libraries/export`. `requireEntitlement("atlas.export")` doesn't change.
- **Location page maps** (`InteractiveMap`) use the same PMTiles source filtered by `continent`/`country`/`region` slug. This retires the 500-pin `/libraries/map-pins` cap. It needs slug properties on features, or one extra `r` (region documentId) key.

### 5. What stays out of scope

Pro data layers backed by outside datasets (per-capita, deprivation, transit, schools, population) are separate sources with their own tiles. This plan only moves the library points.

## Phases

Each phase ships behind the `atlas.tiles` flag until phase 6.

**Phase 0: benchmark rig (do first).** Write a generator for 3M synthetic libraries: jitter real places from GeoNames, weighted by population, with realistic type, hours and facility mixes. Load them into a throwaway local Postgres and Meili. Record tile archive size, the largest tile, build time, Meili p95 for viewport + facets + multiSearch, and Meili RAM and disk.
*Exit:* numbers written into this doc, and the budgets below confirmed or revised.

**Phase 1: Meili fields.** Add the new fields and settings, backfill with batched `updateDocuments`, and add tests in `meilisearch-config.test.ts`.
*Exit:* every Atlas question in §2 answered by Meili within budget against the phase-0 data.

**Phase 2: tile build.** Add the `tile-source` endpoint, the build script, the GitHub Action, the upload and the manifest.
*Exit:* nightly archive published; a z14 city tile under 500 KB; a 3M build under 30 minutes.

**Phase 3: draw from tiles.** Add the `pmtiles` protocol to `AtlasMap`, rebuild the pin, cluster, heat, closures and open-late layers on the vector source, add static filters as expressions and the open-now slot expression, and add the recent-changes overlay (§3).
*Exit:* the Atlas renders 3M libraries with no call to `/libraries/atlas`.

**Phase 4: questions to Meili.** Move counts, suggestions, in view, list view, search tab and filtered low-zoom cells, with a debounce on `moveend`. Keep `atlas.logic.ts`'s filter shapes, and map `AtlasFilters` to a Meili filter string in one tested function.
*Exit:* the existing Atlas tests pass against the new data source; the list view pages through a 3M index.

**Phase 5: pins, deep links, export, location maps.** Everything in §4.
*Exit:* nothing in the UI reads `/libraries/atlas` or `/libraries/map-pins`.

**Phase 6: cut-over.** Remove the flag, delete `GET /libraries/atlas`, `utils/atlas-cache.ts`, `fromFeatureCollection` and `map-pins`, and update CLAUDE.md's Map section.

## Budgets

| Measure | Target |
| --- | --- |
| First pins visible (4G, cold) | < 1.5 s |
| Largest single request to draw the map | < 500 KB |
| Browser memory, Atlas open | < 150 MB |
| Meili viewport count / list query, p95 | < 150 ms |
| Meili multiSearch (base + 6 suggestions), p95 | < 300 ms |
| Tile build, 3M libraries | < 30 min |
| Map staleness without the overlay | ≤ 24 h (≤ 30 min with dispatch) |

## Open questions

1. **Where do tiles live?** Cloudflare R2 (no egress fees, range requests) is the suggestion. S3 + CloudFront also works. Vercel Blob only works if it serves byte ranges, which needs checking before choosing it.
2. **Is a map that lags up to 30 minutes acceptable**, given the recent-changes overlay? Or should approvals block on a rebuild?
3. **Build host:** GitHub Actions (no new infrastructure) or the sync worker (only if it runs in a container).
4. **Meilisearch size:** 3M documents with these facets needs a bigger instance than today. Phase 0 gives the RAM and disk figures to size it.
5. **Open-now precision:** are 30-minute slots enough? Libraries opening at :15 would show as open or shut up to 15 minutes early or late.
