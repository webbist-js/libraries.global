# World place import

Sets each profiled Country's Place Labels, then adds the Regions and Areas that GeoNames (or a curated list) has and the atlas lacks. It only ever adds: nothing already in Strapi is renamed, moved or deleted.

The profiles, `run-rules.ts` and importer source define the mapping and reconciliation rules. Keep run-specific plans and results in ignored reports.

## What it does

Regions and Areas are imported for every Country that has an `iso2` in Strapi — whether or not it has an entry in `country-profiles.ts`. A Country with no entry imports GeoNames level 1 as Regions and level 2 as Areas, adds nothing where places already exist, and keeps its current labels.

1. **Labels.** Sets `regionTypeLabel`, `regionsSectionLabel`, `areaTypeLabel` and `areasSectionLabel` to the profile's labels, when they differ and the Country has no unpublished draft changes (see "Unpublished drafts" below). A country with no profile entry keeps whatever labels it has.
   Then, for each Region named in the profile's `regionLabels`, sets that Region's own `areaTypeLabel` and `areasSectionLabel` (Greater London's "Borough", in a country of districts), under the same unpublished-draft rule, applied to the Region. A Region named there that doesn't exist gets a `warnings` entry; a skipped one is listed in `regionLabelsSkipped`.
2. **Regions.** If the Country has no Regions yet, creates one per source place. If it has some and the profile sets `fill: true` — or the Country is resumable (see "Resuming a partial run") — creates the source places that don't match an existing Region. Otherwise creates nothing; unmatched source places are listed in the report. A Country whose source lists no subdivisions at all, and that has no Region of its own yet, gets one whole-country Region instead — see "Countries with no subdivisions".
3. **Areas.** The same three cases, per Region, at the profile's Area level.

A source place matches an existing place by GeoNames id or GSS code first (checked for every source before any name), then by normalised name, only when that match is unique in both directions. An ambiguous match — a source that hits two existing places, or an existing place two sources hit — matches nothing itself. Whether it's created as a new place depends on the same rule as any other unmatched source: only when the parent had no places to begin with, or `fill` (or resuming) is on; otherwise it's left out, and listed under **both** `ambiguous` and `notAdded` in the report, since it's unmatched for two different reasons. Names may repeat: a Region and an Area can share a name, or two Areas can, and the slug rule (below) tells them apart. A matched place gets its `geonamesId` or `gssCode` filled in if it was empty — see "Filling a matched place" for when that write actually happens.

### Filling a matched place

Filling in a missing `geonamesId` or `gssCode` is written with `?status=published` (Strapi 5's REST default anyway), which publishes the place's whole draft — not just the filled field. That's only harmless when the place already has a published version identical to its draft: draft equals published, so publishing changes nothing else. The import checks this with the same "unpublished changes" rule as labels (next section): a place with a published version and no pending draft edits gets `PUT ?status=published`; a place with no published version at all, or with pending draft edits, is **not** written — it's listed in the report as `fillsSkipped` (`"Region <name>: draft only"` or `"Region <name>: unpublished draft changes"`, same for Areas) and counted, for an admin to fill by hand.

### Countries with no subdivisions

15 countries have no GeoNames subdivisions at all (Aruba, Saint Barthélemy, Curaçao, Western Sahara, the Falkland Islands, Gibraltar, Saint Martin, Norfolk Island, Niue, Pitcairn, Singapore, Sint Maarten, the Turks and Caicos Islands, Vatican City, the British Virgin Islands): GeoNames' source for the Country comes back with zero Regions, so without special handling the Country would never get one — and a library there can't be published without a Region. For such a Country, as long as it has no _other_ Region, the import plans one whole-country Region instead: named after the Country, `sourceId: "country:<iso2>"`, `key: "*"`, no `geonamesId`, no Areas, and `sourceAttribution: "Libraries Global: whole-country region (GeoNames lists no subdivisions)"` rather than the usual GeoNames attribution. It's reported as `wholeCountryRegion: true` on the Country.

The pure rule is `wholeCountryRegion` in `run-rules.ts`: it's planned whenever the source has zero Regions and every one of the Country's existing Regions already carries the whole-country `sourceAttribution` (vacuously true the first time, when it has none yet) — a Country with any _other_ Region (a different attribution, or a hand-made one with none) is left alone. So it's planned again on every re-run, not just the first: the existing Region it already created is this same source by another name, and `planChildren` matches it by name (`matched: 1`, nothing created, not `unmatchedExisting`) instead of leaving it unmatched or creating a duplicate. It also never counts towards `needsDumpForNameMatching` (see "Sources and licences" below): it has no `geonamesId` by design, permanently, so without that exclusion every re-run would conclude a dump download was still needed, forever, for a Region GeoNames was never going to help match anyway.

### Unpublished drafts

Setting a label publishes the Country's whole pending draft (`PUT …?status=published`), so a Country whose draft has changes nobody has published yet is skipped rather than risk publishing something unreviewed. This only matters when there's actually a label to write: the check runs, and `labelsSkipped` is only ever set, for a Country that has at least one label change pending — one with nothing to change never gets `labelsSkipped`, since there was nothing to skip. A Country counts as having unpublished changes when its draft version's `updatedAt` is more than a second newer than its published version's — and, failing closed, whenever either timestamp is missing, so a Country this check can't read is always treated as having changes rather than assumed safe. Such a Country gets `labelsSkipped: "unpublished draft changes; set the labels in admin"` in its report instead of a label write; set its labels by hand in the admin.

### Resuming a partial run

A run that was interrupted partway through creating Regions or Areas can simply be run again. For each parent (a Country for Regions, a Region for Areas), the import checks every one of its _existing_ children's `sourceAttribution`: if the parent has at least one existing child and every one of them carries this run's own source attribution (GeoNames' or the curated list's, whichever this Country's source is), the whole parent was created by an earlier, partial run of this same command, so the import treats it as if its profile had `fill: true` for this run and finishes filling it in. Each parent resumed this way is listed in its Country's report (`resumed`, e.g. `"Region: Kent"` or `"Country: CH"`).

This check deliberately doesn't use `geonamesId` or `gssCode` for "was this made by an earlier run of this import": a _fill_ writes one of those onto a hand-made place it merely matched by name, but a fill never writes `sourceAttribution` — only a _create_ does. So a fill-off Country or Region (no profile `fill`, not resumable) stays fill-off even after a run that filled in ids on its hand-made places; only a parent this importer actually built resumes automatically. A profile's own `fill` setting is unaffected either way; this only ever adds filling behaviour, never removes it.

### Retrying a write

Each write (a label update, a Region or Area create, or a fill) retries up to three attempts in total — the first try, then one after a 1 second wait, then one after 3 seconds — when it fails with a network error or an HTTP 429 or 5xx response. Any other 4xx response (a bad request, a conflict, and so on) fails immediately with no retry, since trying the same payload again wouldn't help. A 429 whose body names a `Retry-After` wait (in seconds) waits that long — capped at 60 seconds — instead of the fixed 1/3 second backoff. `StrapiClient` doesn't expose response headers, so `Retry-After` is read from the error body alone, and is honoured only when the body actually carries it; a 429 whose body doesn't falls back to the fixed 1/3 second backoff, same as any other retryable failure. The startup reads (Countries, Regions, Areas, and the GeoNames admin-code and per-country dump downloads) retry the same way.

A Region or Area create goes one step further: if a _retried_ attempt (never the first) comes back 400, the import looks the place up **by its planned slug only** — never by `geonamesId` or `gssCode` — before treating the 400 as a failure. A slug this run planned to create is free when the run starts, so only our own earlier attempt (or a concurrent writer) can hold it by the time a retry runs; a `geonamesId` or `gssCode` lookup, by contrast, would find _any_ place carrying that id anywhere in Strapi, including an unrelated one in a different Country. Even then, the row found at that slug is adopted only once it's confirmed to genuinely be this create: its `sourceAttribution` matches, its id matches when the source has one, and its parent (the Country for a Region, the Region for an Area) is the one this create intended — never just because a slug coincides. When all of that holds, the first attempt is treated as having succeeded on the server while its response was lost to a timed-out proxy or a dropped connection; the create is counted as done (so its Areas still get written against the right Region) and the Country's report gets a `warnings` entry instead of an `errors` one. When it doesn't hold — a different place at that slug, no place at that slug, or the lookup itself fails — the original 400 is what's reported (with a note if the lookup also failed), never an unrelated place adopted by mistake.

### Aborting a run

A live run stops dispatching further writes, of any kind, after 25 writes in a row have each failed outright — a sign something is systemically wrong (the token's lost its access, the instance is down, a Country's profile is broken, …) rather than a one-off. This counts any failed write, not only one that exhausted its retries: a deterministic 4xx (say, a bad field value from one Country's own profile, repeated once per source place) fails immediately without retrying at all, but 25 of those in a row still trip the same abort — the one failure mode this guards against doesn't care whether each write got three tries or zero. Any single successful write resets the count. An aborted run still finishes: it writes its report as usual, with a top-level `aborted: "aborted after 25 consecutive failures"` and, per Country, `notAttempted` counting the writes that were skipped once the run had already aborted. It exits 1. Re-running resumes where it left off — fix whatever's systemically wrong first, or the same 25-in-a-row abort will just happen again.

## Sources and licences

**GeoNames** (https://www.geonames.org), CC BY 4.0:

- `https://download.geonames.org/export/dump/admin1CodesASCII.txt`
- `https://download.geonames.org/export/dump/admin2Codes.txt`
- `https://download.geonames.org/export/dump/{CC}.zip` — a per-country dump, each one up to tens of MB; only fetched when the country's Area level is 3, or when `needsDumpForNameMatching` (`run-rules.ts`) says an existing Region or Area still needs it: a GeoNames source only ever carries a `geonamesId`, never a `gssCode`, so for a GeoNames country it's an existing place with no `geonamesId` — a `gssCode`-only place there can still only be matched by name, so it counts too — while a curated country (gssCode-based, e.g. England) counts a place as already id-tagged by either id. A whole-country Region ("Countries with no subdivisions" above) is ignored by this check entirely, since it never carries a `geonamesId` and is matched by name regardless. The dump's alternate names are what lets an id-less, hand-filed place still match by name; an already-id-tagged place matches on id alone and needs no alt names. A country whose places are all already id-tagged skips the download entirely.

Files are cached in `.cache/` (git-ignored); each run records their path in its report.

**England** (`data/england.json`, curated): the 48 ceremonial counties as Regions, and every local authority district (296) as an Area under its ceremonial county, with its ONS GSS code and a type label derived from the code (`E06` Unitary authority, `E07` District, `E08` Metropolitan borough, `E09` London borough; the City of London, `E09000001`, is City corporation). Built from:

1. "Local Authority Districts (April 2025) Names and Codes in the UK (V2)", ONS — district names and GSS codes. https://geoportal.statistics.gov.uk/datasets/5779a9578f0e48ccacef6af41546b56b
2. "Local Authority District to County (December 2024) Lookup in EN", ONS — district to county (two-tier and metropolitan counties, Inner/Outer London). https://geoportal.statistics.gov.uk/datasets/7b21cc353fe940e9b0e05442830939ab
3. "Local Authority District (2024) to Local Authority District (2025) Lookup in the UK (V2)", ONS — the single 2025 code change (Barnsley and Sheffield recoded, names unchanged). https://geoportal.statistics.gov.uk/datasets/40d74f80a6cb49f68fdd9fa53efbb1dd
4. "Local Authority District to County and Unitary Authority (April 2025) Lookup in the UK (V2)", ONS — cross-check for the E07 counties. https://geoportal.statistics.gov.uk/datasets/3a815d3b4fa746a98390f52b1196d37d
5. Ceremonial counties (ties unitary authorities and the two-tier and metropolitan counties to their ceremonial county): Lieutenancies Act 1997, Schedule 1. https://www.legislation.gov.uk/ukpga/1997/23/schedule/1

All ONS datasets are from the ONS Open Geography Portal, licensed under the Open Government Licence v3.0 (https://www.ons.gov.uk/methodology/geography/licences).

**Credits:** `geonames` and `ons-lad` are registered in `apps/strapi/src/seeds/datasets.ts`. Every Region and Area this script creates gets a `sourceAttribution` naming its source (both content types carry the field; Area's was added alongside this script).

**Known gap:** Stockton-on-Tees (E06000004) straddles the River Tees and is split by Schedule 1 between County Durham (the part north of the river) and North Yorkshire (Thornaby, Yarm, Ingleby Barwick, south of it). `england.json` files the whole borough under Durham, since the town of Stockton, Billingham and Norton — most of the borough — lie north of the river. Moving it to North Yorkshire is a one-line change in `data/england.json`.

## Country Profiles

One entry per Country in `country-profiles.ts`, `PROFILES: CountryProfile[]`. A Country with no entry imports GeoNames level 1 as Regions and level 2 as Areas, adds nothing where places already exist, and keeps its current labels.

| Field            | Meaning                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`            | The Country's `iso2` in Strapi: `"CH"`, or `"GB-ENG"` for a UK nation.                                                                                                                                                                                                                        |
| `labels`         | `{ region, regions, area?, areas? }` — the four Place Labels this country should have. Left out, labels are left as they are.                                                                                                                                                                 |
| `regionLevel`    | GeoNames admin level of the Region: `1` (default) or `2`.                                                                                                                                                                                                                                     |
| `areaLevel`      | GeoNames admin level of the Area: `2` (default), `3`, or `null` for a country with no Areas.                                                                                                                                                                                                  |
| `geonames`       | `{ country, admin1? }` — where to read in GeoNames. Defaults to `{ country: key }`; the UK's four nations each name their GB admin1 code (`SCT`, `WLS`, `NIR`).                                                                                                                               |
| `fill`           | Add the source places that don't match an existing Region or Area, even though some already exist. Default `false` — a Country or Region with places gets nothing added.                                                                                                                      |
| `source`         | `"geonames"` (default) or `"curated"`, which reads `data/<curatedFile>`.                                                                                                                                                                                                                      |
| `curatedFile`    | The curated list's filename under `data/`, required when `source` is `"curated"`.                                                                                                                                                                                                             |
| `tidyNames`      | Words to drop from either end of a source name (never down to nothing), e.g. a German "Landkreis " prefix.                                                                                                                                                                                    |
| `areaSlugSuffix` | `"on-clash"` (default) or `"admin1"` — `"admin1"` (US, IMLS style) suffixes every Area slug with its admin1 code, whether or not it clashes.                                                                                                                                                  |
| `aliases`        | `{ "existing place name": "source's spelling" }` — maps an existing place's name to the source's own spelling of it, for the rare pair the matcher can't join by name alone even after normalising. CH sets this (its cantons are filed under their local names; GeoNames uses English ones). |
| `regionLabels`   | `{ "Region name": { area, areas } }` — what one Region calls its Areas, where it differs from the country's `labels.area` (England: Greater London and the six metropolitan counties have boroughs). Written to the Region by the labels step; the site prefers it over the country's.        |

## Running it

From `apps/strapi`:

```bash
# 1. Bring Countries up to date first (run once, separately).
npx tsx scripts/populate-world-countries.ts

# 2. Plan and report. Still needs a token: it reads the Countries, Regions
#    and Areas already in Strapi before deciding what to add.
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… \
  npx tsx scripts/ingests/gazetteer/import.ts --dry-run

# 3. Read the report before running live.
cat scripts/ingests/gazetteer/.runs/*.json

# 4. Run it for real.
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… \
  npx tsx scripts/ingests/gazetteer/import.ts

# 5. Reindex, so library search facets pick up the new Region labels.
pnpm --filter @repo/strapi seed:meilisearch
```

Options:

- `--dry-run` — plan and print the report, write nothing to Strapi.
- `--country=A,B` — one comma-separated list of Country keys (`iso2`, or `GB-ENG` style); not a repeatable flag. A key that matches no Country is listed in the report's `unknownCountries`, printed as a warning, and makes the run exit 1 — every other requested key still runs, so it's a flag to a typo, not a reason to stop early.
- `--step=labels,regions,areas` — run only these steps, as one comma-separated list. Default: all three. Any other value is rejected: the script prints the allowed values and exits before it reads anything from Strapi.

Supply scoped credentials through private environment inputs; checked-in examples contain names and placeholders only. `STRAPI_API_TOKEN` needs an `ingest-*` token with read and write access to Countries, Regions and Areas; without `STRAPI_BRIDGE_SECRET` Strapi ignores `?status=published` qualifiers and the client refuses to start (`scripts/strapi-client.ts`). Writes run at most 8 requests in flight.

Each run writes a JSON report to `.runs/<ISO time>.json` (git-ignored) and prints one summary line per Country.

## The report

Top level: whether it was a dry run, the steps and Countries requested, any `--country` key that matched nothing (`unknownCountries`), whether the run aborted early (`aborted`, otherwise `null`), the input files read, and one entry per Country.

For each Country: the label changes made (or that a dry run would make); `labelsSkipped`, set only when there was at least one label change to write and the Country's draft had unpublished changes (or either side's timestamp was missing) — a Country whose labels already match its profile never gets `labelsSkipped`, since there'd be nothing to skip; `noSourcePlaces: true` when its source came back with zero Regions; `wholeCountryRegion: true` when a whole-country Region was planned instead (see "Countries with no subdivisions"); `fillsSkipped` — matched places whose `geonamesId`/`gssCode` fill was _not_ written, because publishing it would have published a draft-only place or one with pending draft edits (see "Filling a matched place"); and, for Regions and Areas — created, matched, filled (an existing place that got a missing `geonamesId`/`gssCode` written and published; a failed fill is counted as an error instead, not as filled), not added (and why — the only reason today is `parent-has-places`: the parent already had children and neither `fill` nor resuming applied), `ambiguous` (source names that hit more than one existing place, or that another source also hit), and `unmatchedExisting` (existing places no source place matched). Areas also get `noRegion`: source places whose parent Region isn't in the plan at all (its own source place didn't match or get created, usually because the Region step was skipped or failed). Also, per Country: `resumed` (parents resumed because this importer created every one of their existing children — see "Resuming a partial run"); slugs that took a suffix (only ones that were actually created, on a live run; every planned one, on a dry run); any parent with more than 1,000 children (the place picker lists up to 1,000); `warnings` — non-fatal notes that don't affect the exit code: a Region created for a Country with no continent (`"no continent: entityRef won't compute"`, since `entityRef` needs one), and a create a retry had to reconcile against what was already there; `errors` — anything that does set the exit code, including a write that failed after its retries; and `notAttempted` — writes for that Country skipped because the run had already aborted (see "Aborting a run") by the time they'd have been dispatched.

## Known gaps

- **Non-Latin names never match by name.** A source name in a script the matcher can't normalise to Latin letters compares as `""` and never matches an existing place. Whether that makes it a new place follows the same rule as any other unmatched source — only when the parent is empty, `fill` is on, or the parent is resumed — so it isn't always created fresh; where none of those hold, it's correctly left out and reported, like any other unmatched source. When it is created, it can duplicate a place already in Strapi under its local name.
- **Names keep their own letters; slugs don't.** A Region or Area is named exactly as its source spells it, including diacritics ("Łódź Voivodeship", "Bavaria"). Its slug is the ASCII transliteration ("lodz-voivodeship").
- **Shared names are allowed.** A Region and an Area, or two Areas, can have the same name — the atlas doesn't require unique names, only unique slugs. A repeated base slug gets a suffix (the Country's `iso2` for Regions, the parent Region's slug for Areas), and a slug still clashing after that gets a GeoNames id or GSS code appended. A US Area's slug always carries its state's admin1 code (`areaSlugSuffix: "admin1"`), whether or not it clashes, so it never shows up in `suffixedSlugs` even though the slug does differ from the plain name.
- **Unreviewed country profiles are provisional.** They haven't been checked place by place and may need a profile fix once reviewed.
- **Latvia and Slovenia can't source Regions from GeoNames.** GeoNames level 1 for both is municipalities, but the atlas holds Latvia's five planning regions and Slovenia's twelve statistical regions instead — a different level GeoNames doesn't expose. Both profiles set `areaLevel: null` and import nothing; their Regions stay hand-maintained.

## Go-live runbook

1. **Deploy first.** The `geonames_id` indexes on Region and Area (`HOT_PATH_INDEXES`) and the new schema fields this import writes — `geonamesId` and `sourceAttribution` on Region; `geonamesId`, `gssCode` and `sourceAttribution` on Area — must already be live before the import runs against that environment — this script doesn't create them.
2. Review the bulk invalidation/load strategy with the operator before applying a large import. Verify that the selected release supports its intended revalidation behavior; retain environment-specific toggle commands and acceptance evidence in private operator storage.
3. **Run `pnpm --filter @repo/strapi seed:meilisearch` after the import.** Find libraries reads library search facets (Region names, Place Labels) from the Meilisearch index, not Strapi directly, so new places and label edits don't show there until a reseed.
4. A Place Label edited by hand in Strapi admin, same as an import-written one, only reaches Find libraries after that reseed.
