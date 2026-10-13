## Scale target

**Build for every library on earth: about 2.9 million records.** Today there are hundreds, but the aim is the complete index, so every feature must still work at that size. Reasoning: `docs/adr/0004-design-for-three-million-libraries.md`.

Rules for new code:

- **Never load every library at once.** No endpoint, page, sitemap, build step or browser view may fetch, hold or loop over the whole library table. Cap every read at a fixed limit, or page through it.
- **Page by keyset, not offset.** Walk large tables with `id > after` in id order (see `/libraries/slugs` and its `meta.next`). A deep `start=` offset gets slower the further in it goes.
- **Count in the database.** Use grouped SQL (`utils/library-tally.ts`, `utils/library-location-counts.ts`) or `documents().count()`; never fetch rows only to count them in JS.
- **Ask Meilisearch the questions.** Filtered counts, facets, viewport (`_geoBoundingBox`) and "near me" queries go to the `library` index, not to Strapi row scans. Find libraries asks for one page plus facet counts (`apps/ui/src/lib/find-search.ts`) over fields the index derives for it (`apps/strapi/src/utils/library-search-fields.ts`: open-now hours, `needs` (every Gap key), completeness, a globe grid cell, and created/verified timestamps). Take totals from a facet count (the `locale` facet): `totalHits` stops at the index's `maxTotalHits` of 1,000.
- **Split outputs that grow with the index.** Sitemaps are an index of 10,000-URL files (`lib/sitemap/`); exports are capped by `limits.exportRows`.
- **Index what you filter or sort on.** Any library column used in a filter or sort needs a database index and, if it drives search or maps, a Meilisearch filterable attribute.
- **Bulk imports bypass per-row paths:** write in batches and reindex Meilisearch in batches, not one Document Service call and one sync per library.

Known places that don't meet this yet: the Atlas downloads every library (`GET /libraries/atlas`). It is replaced by the vector tiles plan in `docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md`. Don't build new features on this endpoint.

Two bounded scans to keep bounded: Mobile stops live in their own Meilisearch index, `mobile-stop` (one document per mapped stop, timetable and place data only, no account ids or staff names; `utils/mobile-stop-index.ts`). The Atlas, Find libraries and Area pages page it with `stop_id > last` and take counts from facets, and `seed:mobile-stops` rebuilds it per vehicle in pages of 50. The hourly `mobile-local-midnight` job refreshes only the Mobile libraries whose local midnight has just passed: it filters `timezone $in` the zones now at 00:xx, pages by `id > after` and batch-loads Notices per page, on the `libraries.library_type` index. Never widen either to every library.

---
