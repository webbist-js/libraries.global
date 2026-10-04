# Place labels, Location Request removal and the world place import

**Date:** 2026-10-04
**Status:** Draft for review
**Supersedes in part:** `2026-09-29-community-moderation-and-audit-design.md` workstream F ("Region and Area requests from the new-library flow"). Location Requests are removed; the "every country imported" half of F stands and is extended here to Regions and Areas.
**Related:** ADR-0003 (programmatic location pages), ADR-0004 (design for three million libraries), CONTEXT.md (Region, Area, Location Request), `docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md` (unaffected).

## 1. Summary

At go-live every country, region and area should already be in the index, so a contributor never needs to ask for one. The "Not listed?" Location Request form in the Index editor therefore makes no sense, and the words "Region" and "Area" confuse people whose country calls them something else (a Swiss reader looks for a canton, an English one for a county and a district).

| Workstream                        | Outcome                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Remove Location Requests       | The `location_request` Submission type is gone from the UI, `@repo/access`, Strapi, emails, tests and docs                                                                   |
| B. Remove the boundary drill-down | `InteractiveMap`, the `/map-pins` routes, 105 MB of boundary GeoJSON and every `boundaryUrl` field are deleted; the Area page uses the same pins map as the Region page      |
| C. Place Labels                   | Each Country says what its Regions and Areas are called, singular and plural, localised; the UI uses those words wherever one country is in context. Labels only, never data |
| D. World place import             | A repeatable script adds every missing Country, Region and Area from GeoNames (England from a curated ONS list), only ever adding, with a dry run and a review report        |

Decisions taken with the owner on 2026-10-04:

1. **Remove Location Requests entirely**, not just the form. Pre-launch, so no dead paths. A genuinely missing place is handled by leaving Region empty; the Moderator files the library with the existing target picker.
2. **Region and Area stay the schema and data terms.** The new Country fields are UI labels only. No existing Region, Area or Library is re-parented, renamed or deleted.
3. **Areas for every country's second level** (or the level its Country Profile names), not a curated subset.
4. **Fill only what is empty.** A Country with no Regions gets the full set and a Region with no Areas gets its Areas. Where children already exist, nothing is added unless that country's profile opts in; unmatched source places go to a review report.
5. **England:** Region label "County", Area label "District". Each Area still shows its own type ("London borough", "Metropolitan borough", "City", "Unitary authority").
6. **Source:** GeoNames (CC BY 4.0), driven by a reviewed Country Profile file, written over REST like the other ingests. The libraries-local MCP is for spot checks and report fixes, not bulk writes.
7. **Map cleanup is the boundary drill-down only.** `mapConfig` stays (hero maps use its bounding boxes) and the atlas vector-tiles plan stays (it is the pin-scaling fix, not boundaries).

## 2. Vocabulary

Unchanged: **Region**, **Area**, **Country**, **Entity Reference**.

New terms (add to CONTEXT.md):

- **Place Labels**: the four localised strings on a Country that name its Regions and Areas in the UI: `regionTypeLabel` and `regionsSectionLabel` (singular, plural), `areaTypeLabel` and `areasSectionLabel`. Display only; they never change routing, hierarchy or data. _Avoid_: region type, area type (those are the per-place `typeLabel`).
- **Country Profile**: one entry per country in the import's profile file: its Place Labels, which source level is its Region and which its Area, whether it opts in to filling gaps, and an optional curated source. _Avoid_: country config, country settings.

Removed: **Location Request** (delete the term; remove it from the definitions of Submission, Moderation Queue `index` and Capability).

## 3. Workstream A: Remove Location Requests

Everything listed goes. Specs written before this one keep their text as history.

### 3.1 UI (`apps/ui`)

- `app/[locale]/contribute/index/_components/LocationRequestForm.tsx` and `__tests__/LocationRequestForm.test.ts`: delete.
- `LocationHierarchySelector.tsx`: remove `LocationRequestsContext`, `withoutProposal`, `Proposal`, the two "Not listed?" buttons, the `asking` state and the form mount. The component keeps its four cascading selects.
- `IndexRecordWizard.tsx`: remove the `LocationRequestsContext.Provider`.
- `wizard.types.ts`: remove `proposedRegionName`, `proposedAreaName` and `locationRequestDocumentId` from `FormData` and its initial value.
- `components/moderation/LocationRequestPanel.tsx`: delete, with its export in `components/moderation/index.ts` and its entry in `submissionMeta.ts`.
- `components/moderation/NewLibraryPanel.tsx`: remove the proposed region/area lines, the Location Request link and `pendingLocationRequest`.
- `app/[locale]/contribute/moderation/[documentId]/page.tsx`: remove the Location Request branch.
- `app/api/moderation/submissions/[documentId]/target/route.ts`: `bodyKeys` drops `name` and `typeLabel`.
- `components/contributions/contributions.ts` and `lib/role-application.ts`: remove the type from their maps and counts.

### 3.2 `@repo/access`

Remove `location_request` from `SUBMISSION_TYPES`, `QUEUE_OF_SUBMISSION_TYPE` and the `canSubmit` switch; update `tests/capabilities.test.ts` and `tests/moderation.test.ts`. Rebuild the package.

### 3.3 Strapi (`content-moderation` plugin)

- `server/content-types/submission/schema.json`: drop the enum value.
- `server/services/submission-policy.ts`: drop its rules.
- `server/services/submission.ts`: drop the approval branch that creates a Region or Area, and the `new_library` step that files a library under the Region or Area of an approved Location Request.
- `server/controllers/moderation.ts`: drop `pendingLocationRequest` from the detail, and the `name`/`typeLabel` edit on the target route.
- `server/utils/params.ts`, `target-labels.ts`, `submission-summary.ts`, `admin/src/components/submissionMeta.ts`: drop the type.
- `server/services/notifications.ts` and `server/utils/email-templates.ts`: drop the Location Request template and its `MODERATORS_EMAIL` trigger. Role Applications still email moderators.
- Tests: delete `tests/content-moderation/location-request.test.ts`; update `target-labels.test.ts`, `moderation-api.test.ts` and `drafts.test.ts`.
- Run `pnpm --filter @repo/strapi build:plugins`.

### 3.4 Data, QA and docs

- Local data: delete any existing `location_request` Submissions by hand, once. No migration file. Regions or Areas they created are real places and stay.
- `qa/tests/playwright/e2e/access/location-request.spec.ts`: delete. `role-matrix.spec.ts`: drop the type.
- CLAUDE.md: remove Location Requests from pillar 6, §3 (submission types and queues, "On approval", "Location Requests", Notifications, points) and the Testing access list.
- CONTEXT.md: as §2.

## 4. Workstream B: Remove the boundary drill-down map

`InteractiveMap` draws clickable country, region and area polygons and drills down on click. Only `AreaDetailPage` uses it. The Atlas and every other location page already use something else.

- Delete `apps/ui/src/components/map/InteractiveMap.tsx`, `LibraryPinPanel.tsx` (only `InteractiveMap` renders it) and `map.types.ts`. `map.helpers.ts` keeps only what other code imports: `parseBounds` (`LocationHeroMap`) and `BASEMAP_ATTRIBUTION` (`AtlasMap`).
- `lib/strapi-api/request-auth.ts`: drop the five `map-pins` paths from the public proxy allowlist; `lib/strapi-api/cache-tags.ts`: drop `map-pins` from the action segments.
- `AreaDetailPage.tsx`: render `LocationHeroMap` with pins built from the Area's libraries and bounds from `area.mapConfig`, exactly as `RegionDetailPage.tsx` does.
- Delete the Strapi routes and controller actions behind `continents/map-pins`, `countries/map-pins`, `regions/map-pins`, `areas/map-pins` and `libraries/map-pins`; `InteractiveMap` is their only caller.
- Delete `apps/ui/public/boundaries/` and `apps/ui/scripts/download-boundaries.mjs`. First move `boundaries/seed-data.json` to `apps/strapi/scripts/ingests/gazetteer/data/seed-data.json`, dropping its `boundaryUrl` values; the world-countries import reads it (§6.3 step 1).
- Remove `boundaryUrl` from the Continent, Country, Region and Area schemas, their controllers, `utils/populate-shapes.ts`, `scripts/strapi-client.ts`, `scripts/world-countries.ts`, `scripts/populate-world-countries.ts` and their tests. Regenerate `packages/strapi-types` and `types/generated`.
- Delete `apps/strapi/scripts/populate-eu-boundaries.ts`.
- Keep `mapConfig` on all four types.
- CLAUDE.md: remove "GeoJSON boundary files served from `public/boundaries/`", the `InteractiveMap` line under Map helpers, and "location-page maps stop at 500 pins (`/libraries/map-pins`)" from the scale section. Add one line at the top of the vector-tiles plan noting `InteractiveMap` and `/map-pins` are gone.

## 5. Workstream C: Place Labels

### 5.1 Schema

Country gains two fields beside the two it has. All four are localised strings with this admin description: "UI label only. Doesn't change the hierarchy."

| Field                 | Status  | Example (England) | Example (Switzerland) |
| --------------------- | ------- | ----------------- | --------------------- |
| `regionTypeLabel`     | exists  | County            | Canton                |
| `regionsSectionLabel` | exists  | Counties          | Cantons               |
| `areaTypeLabel`       | **new** | District          | District              |
| `areasSectionLabel`   | **new** | Districts         | Districts             |

`regionTypeLabel` keeps its default `"Region"`. `areaTypeLabel` has no default; an empty value falls back in code.

### 5.2 One helper

`regionLabels()` in `components/location/location-page.helpers.ts` becomes `placeLabels(country)`, returning `{ region: { singular, plural }, area: { singular, plural } }`. For each level: the plural field if set, else the singular pluralised by the existing `pluralizeLabel`, else "Regions"/"Areas". A singular containing "/" (today's mixed English label) falls back as it does now. Every caller below goes through this helper; no component reads the four fields directly.

On a place's own hero, the place's `typeLabel` wins, then the country's singular label, then "Region"/"Area".

### 5.3 Where the labels show

Only where exactly one country is in context:

- **Index editor place picker** (`LocationHierarchySelector`, used by the wizard and by the Moderator's target picker in `NewLibraryPanel`): once a country is selected, the Region and Area select labels become that country's singular labels ("Canton", "District (optional)"). `/api/relations/countries` returns `regionTypeLabel` and `areaTypeLabel` with each country.
- **Find libraries** (`FindFilterSidebar` `PLACE_SELECTS`): the third select reads "County" / "All counties" once a country is chosen, from the place data the sidebar already loads, extended with the two labels.
- **Country page**: regions section title (already labelled; moves to `placeLabels`).
- **Region page**: hero fallback, and the areas section title, which today guesses from `data.areas[0]?.typeLabel`.
- **Area page**: hero fallback (today a hard-coded "Area").

Unchanged: the Atlas and any cross-country list, the change-history field names in `change-history.helpers.ts`, and Strapi admin.

## 6. Workstream D: World place import

### 6.1 Layout

```
apps/strapi/scripts/ingests/gazetteer/
  README.md               how to run, sources, licences, known gaps
  import.ts               CLI entry: --dry-run, --country=XX (repeatable), --step=countries|labels|regions|areas
  country-profiles.ts     one Country Profile per country
  geonames.ts             download, cache, parse (pure parsing is unit-tested)
  match.ts                name normalising and matching (pure)
  slugs.ts                slug rule (pure)
  data/seed-data.json     moved from apps/ui/public/boundaries (§4)
  data/england.json       curated ceremonial counties and districts
```

It reuses `scripts/strapi-client.ts` and `scripts/ingests/_shared/` (CLI, run log, source-file hashing), like the IMLS ingest.

### 6.2 Sources

- **GeoNames** (CC BY 4.0):
  - `https://download.geonames.org/export/dump/admin1CodesASCII.txt` and `admin2Codes.txt`: every level-1 and level-2 division in the world, with its code, English name, ASCII name and `geonameid`.
  - `https://download.geonames.org/export/dump/{CC}.zip`, only for a country whose Area level is 3: its rows with feature class `A` and code `ADM3`, plus their alternate names (used as extra match candidates).
  - Files are cached in `.cache/` (git-ignored); each run logs their SHA-256.
- **England** (`data/england.json`, curated): the 48 ceremonial counties as Regions, and every local authority district (about 296) as an Area under its ceremonial county, with its ONS GSS code (stored in the existing `Area.gssCode`) and its own type label, from its GSS code: `E06` Unitary authority, `E07` District, `E08` Metropolitan borough, `E09` London borough (the City of London, `E09000001`, is City corporation). Built from ONS's published district names and codes (Open Government Licence v3).
- **Credits:** add `geonames` and `ons-lad` to `apps/strapi/src/seeds/datasets.ts`. Imported places get `sourceAttribution` naming their source.

### 6.3 Steps

Each step has a dry run that writes nothing and prints what it would do. `--country` limits any step to the listed countries.

1. **Countries.** Run the existing world-countries import, now reading `data/seed-data.json`. It brings the 44 published countries up to about 247. The UK stays as its four nations; GB itself is never created as a Country.
2. **Labels.** Set the four Place Labels of every country that has a profile entry. For those countries the profile file owns the English labels, so a re-run resets any hand edit made in admin; the dry run lists every change. Countries without an entry keep whatever labels they have. Other locales are left alone.
3. **Regions.** For each country:
   - no Regions yet: create one per source place at the profile's Region level;
   - some Regions and `fill: true`: create the source places that don't match an existing Region;
   - otherwise: create nothing; unmatched source places go to the report.
4. **Areas.** For each Region, the same three cases at the profile's Area level. An Area's Region is found through the GeoNames `admin1 code` (so a level-3 Area, such as a German Kreis, hangs directly off its Land). Names may repeat: an Area may share its name with a Region or with another Area (owner decision, 2026-10-04: every world place is imported). England's existing Region "Thurrock" stays, and the district Thurrock is also added under Essex.

### 6.4 Country Profiles

```ts
type CountryProfile = {
  iso2: string // "CH", or "GB-ENG" for a UK nation
  labels: { region: string; regions: string; area?: string; areas?: string }
  regionLevel?: 1 | 2 // default 1
  areaLevel?: 2 | 3 | null // default 2; null = this country has no Areas
  geonames?: { country: string; admin1?: string } // UK nations: { country: "GB", admin1: "SCT" }
  fill?: boolean // add missing places where some already exist
  source?: "geonames" | "curated" // default "geonames"; "curated" reads data/<slug>.json
  tidyNames?: string[] // type words to drop from names, e.g. ["Landkreis ", "Kanton "]
  areaSlugSuffix?: "on-clash" | "admin1" // default "on-clash"; US uses "admin1" (IMLS style)
}
```

A country with no entry gets Region level 1, Area level 2 and no fill, and its labels are left as they are (new countries show the code fallbacks "Region"/"Area"). The 44 countries published today each get an entry that starts from their current labels, so none regresses. The deliberate changes are England's mixed label and five labels that name the wrong level today: Belgium ("Province" on its three regions → Region), Bosnia and Herzegovina ("Canton" on its entities → Entity), Latvia and Slovenia ("Municipality" on statistical regions → Region), Kosovo ("Municipality" on districts → District) and Northern Ireland ("County" on its districts → District). Entries for the other countries most likely to have libraries are written and checked next. `aliases` maps an existing place's name to the source's spelling where the matcher can't join them (England's "Bournemouth and Christchurch and Poole"). Known entries:

- **England** (`GB-ENG`): `source: "curated"`, `fill: true`, labels County/Counties, District/Districts.
- **Scotland, Wales, Northern Ireland**: GeoNames GB level 2 under their nation code, no Areas. They already have Regions, so nothing is added without `fill`.
- **United States**: `fill: true` (the IMLS run created New York and some of its counties), `areaSlugSuffix: "admin1"`, labels State/States, County/Counties.
- **Germany**: `areaLevel: 3` (Kreise; GeoNames level 2 is Regierungsbezirke).
- **Monaco, Andorra, Liechtenstein, San Marino, Vatican City, Singapore** and similar: `areaLevel: null`.

### 6.5 Matching

A source place matches an existing place of the same type in the same parent (Country for Regions, Region for Areas) when, in order:

1. its `geonamesId` (or GSS code) equals the existing place's; ids are matched for every source before any name; or
2. its normalised name, or any of its alternate names normalised, equals the existing place's normalised name, and that pairing is unique: a source that hits two existing places, or an existing place that two sources hit, is ambiguous. Ambiguous sources match nothing (no id is written anywhere), are treated as unmatched, and are listed in the report.

The result doesn't depend on the order of the source rows.

Normalising: letters without a separable accent transliterated (ł→l, ø→o, æ→ae, ß→ss, đ→d, ı→i, þ→th, œ→oe), lower case, accents and apostrophes removed (NFKD; "Hawke's Bay" = "Hawkes Bay", like `slugify`), "&" to "and", punctuation removed, spaces collapsed, then generic type words removed ("county", "region", "province", "canton", "district", "oblast", "voivodeship", "municipality", "department", "prefecture", "governorate", "parish", "state", "of", "the") together with the country's own labels.

A match fills an empty `geonamesId` on the existing place, but doesn't always write it: a fill is written with `?status=published` (Strapi 5's REST default anyway), which publishes the place's whole draft. The import only writes the fill when the place already has a published version identical to its draft (draft equals published, so publishing changes nothing else); a place with no published version at all, or with pending draft edits, is left for an admin to fill by hand and is listed in the report (`fillsSkipped`) instead.

New field: `geonamesId` on Region and Area (string, unique, not localised), indexed through the bootstrap `HOT_PATH_INDEXES` list (no migration file). Re-runs match by it, so they never duplicate.

### 6.6 New records

- `name`: as the place is written universally: GeoNames' standard name from the admin-code files (English-language form, with its own letters and accents, e.g. "Łódź Voivodeship", "Bavaria"); level-3 places use the country dump's name. Then the profile's `tidyNames`, unless tidying would give two places in one parent the same name.
- `slug`: §6.7.
- `typeLabel`: empty (the country label shows) except for curated rows.
- `country`, `continent` and, for Areas, `region` relations; `geonamesId` or `gssCode`; `sourceAttribution`.
- Published on create. A library can't be published under a draft place.
- `entityRef` is left to the existing `entityRef` lifecycle, as for any other write.
- `mapConfig`, population and summary stay empty. The hero map appears once a place has libraries (ADR-0003 keeps empty pages `noindex`).

### 6.7 Slugs

Region and Area pages are looked up by slug alone, and Strapi checks a published `uid` across the whole type, so slugs must be unique per type.

- Start from the slugified name (ASCII: letters transliterated as in §6.5, so "Łódź Voivodeship" is `lodz-voivodeship`).
- Compute every planned slug for the run first, against all existing slugs of that type, so the result doesn't depend on processing order.
- A slug used by more than one place (existing or planned) gets a suffix on every **new** place that shares it. Existing slugs never change.
  - Regions: `-{iso2}` (`limburg-nl`, `limburg-be`).
  - Areas: `-{region slug}`. With `areaSlugSuffix: "admin1"` (US) every Area gets `-{admin1 code}`, lower-cased, whether or not it clashes, matching the IMLS ingest (`washington-county-ny`).
  - Still clashing: add `-{geonamesId}`, then `-2`, `-3`… until unique.

### 6.8 Writing

- REST through `StrapiClient` with an `ingest-*` token and `STRAPI_BRIDGE_SECRET`, at most 8 requests in flight, each place one create. Regions and Areas aren't in Meilisearch and aren't audited by Change Records, so per-place calls are fine at this size (about 3,500 Regions and up to about 45,000 Areas; fewer in practice, because countries with places only grow where `fill` is set). Each create also runs the `entityRef` lifecycle, a single extra write, since new places have no libraries.
- Order: all Regions of a country before its Areas.
- The same command runs against Strapi Cloud at go-live; that run is a go-live runbook item, outside this spec.

### 6.9 Report

Each run writes a JSON report and prints a summary per country: created, matched, skipped (and why), source places not added because the parent already had children, existing places with no source match, label changes, slugs that took a suffix, and any parent with more than 1,000 children. Report items are fixed by hand: through the MCP, in admin, or by setting `fill` and re-running.

### 6.10 Place pickers at the new size

`app/api/relations/[type]/route.ts` caps lists at 500. The largest real parents are about 850 children (Minas Gerais, Brazil). Raise the Region and Area cap to 1,000 and keep the native `<select>`, which already lets you type to jump. The report flags anything over 1,000.

## 7. Testing

- **A:** `@repo/access` tests, the Strapi content-moderation tests and the role-matrix Playwright spec are updated; the Location Request unit and E2E tests are deleted. `pnpm --filter @repo/strapi build:plugins` builds.
- **B:** unit tests that reference `boundaryUrl` or the map-pins routes are updated or deleted; the Area page renders its map from libraries and `mapConfig` (component test).
- **C:** `placeLabels()` tests replace the `regionLabels()` tests (singular, plural, fallback, mixed "/" label); a `LocationHierarchySelector` test checks the labels change when a country is picked.
- **D:** unit tests with small fixtures for GeoNames row parsing, profile defaults, name normalising and matching, the fill rules (empty, `fill`, report) and the slug rule (clash with existing, clash within the run, US suffix). Dry runs for CH, GB-ENG, US and DE are reviewed before the first full write.
- Typecheck, lint, Strapi type regeneration.

## 8. Order of work

A, B and C are independent and small. D needs C (the `areaTypeLabel` and `areasSectionLabel` fields) and B (the moved seed data and `boundaryUrl` gone from the world-countries script).

1. A: Remove Location Requests.
2. B: Remove the boundary drill-down.
3. C: Place Labels.
4. D: profiles and the curated England file, then the dry runs, then the full local run, then report fixes.

## 9. Out of scope

- Place names in locales other than English. GeoNames alternate names (already downloaded) or Wikidata can fill them when `LIVE_LOCALES` grows.
- Restructuring existing places, such as moving England's unitary-authority Regions under their counties.
- Filing libraries by coordinates (point in polygon).
- `mapConfig` bounding boxes, population and summaries for imported places.
- A searchable combobox for long place lists.
- Running the import against production (go-live runbook).
