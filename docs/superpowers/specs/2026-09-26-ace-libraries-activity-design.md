# Organisations + ACE Libraries Activity Data — Design

**Date:** 2026-09-26
**Status:** Approved in brainstorming, pending spec review

## Goal

Publish Arts Council England's *Libraries Activity Dataset 2023/24* (activity in English public library services, April 2023 – March 2024) on libraries.global, with visualisation, benchmarking and export that clearly beat https://activity.librarydata.uk/ — and do it through a reusable **Organisation** concept rather than a one-off data page.

Audience is layered:

- **Curious public** — plain-language headlines, "find your library service".
- **Library professionals / councillors** — per-capita benchmarking, similar-authority comparison, seasonality, format mix.
- **Researchers / journalists** — explorer, CSV/JSON export, methodology, shareable URLs.

## Source data

- File: `Libraries Activity Data 2023-24 FINAL.xlsx` (ACE, accurate as of August 2025, Open Government Licence). Sheets: *Introduction*, *Field definitions and notes*, *Activity Data 2024*.
- 129 rows, one per library authority (upper-tier local authority), ~504 columns.
- Metric groups (mostly 12 monthly columns each): active members (total + children ≤11 / teens 12–17 / adults 18+); physical and digital events and attendees, by age; physical book, physical audiobook, eBook and eAudio issues, by age; physical visits (non co-located / co-located sites), click & collect, mobile libraries, home delivery; public PC/device hours; wifi sessions; point-in-time counts at 31/03 (PCs & devices in service, devices for loan, device loan issues); free-text "why no data" columns.
- Quality: ~58% of numeric cells are blank. Some series are placeholders (e.g. constant `1` or `5` every month). Some columns contain `"Yes"` / `"No"` / `"nan"` strings.
- Authorities are identified by name only — there are no GSS codes in the source.

## Decisions

| Topic | Decision |
|---|---|
| Placement | Organisation pages, not a generic `/data` hub. ACE is an organisation related to England; the dataset belongs to it. |
| Library services | Each of the 129 authorities becomes an Organisation (`orgType: library_service`), linked to its atlas Area by GSS code. Its page hosts that service's activity data. |
| Enrichment | ONS mid-2023 population (per-1,000 rates), IMD 2019 upper-tier summaries, ONS rural–urban classification, and England region. All joined by GSS code. |
| Data quality | Flag, never alter or estimate. Flagged values are shown with distinct styling and a reason, and are excluded from national totals, medians and ranks by default (a toggle includes them). Each service gets completeness scores. |
| Storage | A build-time pipeline produces static JSON bundles. Strapi holds only Organisation and Dataset metadata; observations are not stored in Strapi. |
| Charts | d3 modules (`d3-scale`, `d3-shape`, `d3-array`) for maths, React for the SVG, `T` design tokens. MapLibre for the choropleth. |

## Data model (Strapi v5)

### `organisation` (collection type, Draft & Publish, i18n on text fields)

| Field | Type | Notes |
|---|---|---|
| `name` | string, i18n | |
| `slug` | uid | stable across locales |
| `orgType` | enum | `national_body`, `library_service`, `network`, `consortium`, `other` |
| `description` | blocks, i18n | |
| `website` | string | |
| `logo` | media | |
| `countries` | relation m2m → country | ACE → England |
| `regions` | relation m2m → region | optional |
| `area` | relation m2o → area | library services only |
| `gssCode` | string, unique when set | the join key for library services |
| `aliases` | JSON (string[]) | alternate names from sources, e.g. "Bolton" and "Bolton Libraries & Museum Service" |
| `datasets` | relation o2m → dataset | inverse of `dataset.organisation` |

The library → organisation relation ("run by") is deferred to phase 5.

### `dataset` (collection type, Draft & Publish)

| Field | Type | Notes |
|---|---|---|
| `title` | string, i18n | "Libraries Activity Data 2023/24" |
| `slug` | uid | `libraries-activity-2023-24` |
| `series` | string | `libraries-activity`; groups annual releases |
| `period` | string | `2023-24` |
| `organisation` | relation m2o → organisation | publisher (ACE) |
| `releasedAt` | date | |
| `sourceUrl` | string | |
| `licence` | string | "Open Government Licence v3.0" |
| `methodology` | blocks, i18n | editorial; the pipeline seeds the field definitions and quality-check rules |
| `bundlePath` | string | `/datasets/ace-libraries-activity/2023-24` |

Regenerate `packages/strapi-types` after the schema changes. Add public `find` / `findOne` permissions for both types.

## Pipeline — `packages/datasets/`

A new workspace package in TypeScript, run manually per release with `pnpm --filter @libraries-global/datasets build:ace-activity`.

```
packages/datasets/
  sources/ace-libraries-activity/2023-24/
    activity.xlsx
    population-mid2023.csv        # ONS upper-tier (CTYUA) mid-2023 estimates
    imd2019-utla.csv              # IMD 2019 upper-tier summaries
    rural-urban-utla.csv          # ONS rural-urban classification
    authority-map.json            # ACE name -> { gss, slug, aliases }
  src/ace-libraries-activity/
    catalogue.ts                  # metric definitions
    read.ts                       # xlsx -> raw rows
    reshape.ts                    # wide -> long observations
    quality.ts                    # flags + completeness
    derive.ts                     # annual totals, rates, national stats, ranks, peers
    insights.ts                   # rule-based insight sentences
    write.ts                      # JSON bundles
    seed.ts                       # Strapi upserts
  test/fixtures/                  # ~5-authority fixture xlsx
```

### Steps

1. **Read.** Parse *Activity Data 2024*. Treat blanks, `"nan"` and non-numeric strings as missing. Keep the free-text "no data" reasons as per-authority notes.
2. **Match.** Resolve each authority name to a GSS code through `authority-map.json`. An unmatched name fails the run. The map is hand-checked once and committed.
3. **Catalogue.** Every source column maps to one catalogue metric: `{ id, label, theme, unit, channel (physical|digital), ageGroup (all|children|teens|adults|allAges), parentId?, periodicity (monthly|annual|snapshot) }`. A source column with no catalogue entry fails the run. Themes: `members`, `loans`, `visits`, `events`, `digital-access`.
4. **Reshape** into observations `{ gss, metricId, month: "2023-04".."2024-03" | null, value: number | null }`.
5. **Quality flags** per observation (a value may carry several):
   - `missing` — blank or non-numeric.
   - `constant_series` — all 12 months have the same value and it is at most 10, or the series is otherwise constant for a metric where that is implausible (the catalogue marks which metrics).
   - `breakdown_exceeds_total` — the age or channel parts sum to more than the parent for that month.
   - `outlier` — the annual per-1,000 rate is more than 3 median absolute deviations from the median of peers for that metric.
   - `annual_mismatch` — a reported annual figure (e.g. active members) is inconsistent with its monthly components where both exist.

   **Completeness** = share of expected monthly observations that are present and unflagged, reported per theme and overall per authority.
6. **Derive.**
   - Annual totals per authority and metric (sum of monthly values; `null` if more than 2 months are missing or flagged, so gaps are never summed as zero).
   - Per-1,000-residents rates.
   - National total, median and IQR per metric and month, over clean values only, with `nReporting`.
   - Rank among all reporting authorities and among peers.
   - **Peers ("similar authorities")**: same rural–urban class and same IMD quintile. If that gives fewer than 5, widen to the IMD quintile alone. The rule is documented on the methodology page.
7. **Insights.** Rule templates generate sentences such as the peak month nationally for loans, the largest digital share of loans, and above-median visits per 1,000 among peers. A rule is skipped when `nReporting` < 10.
8. **Write** to `apps/ui/public/datasets/ace-libraries-activity/2023-24/`:
   - `catalogue.json`
   - `summary.json` — national headlines, insights, and each authority's annual headline figures, completeness and ranks (target under 150 KB).
   - `authorities/{gss}.json` — one authority's full monthly series with flags, peers and notes.
   - `metrics/{metricId}.json` — all authorities for one metric (monthly + annual + rate + flags), used by the map, dot strips and explorer.
   - `export/full.csv` — the complete long-format table with flags.
9. **Seed** Strapi through the REST API with a super-editor token, idempotent. Upsert ACE (`national_body`, countries: England), the 129 library-service organisations (keyed on `gssCode`, `area` resolved by the Area's `gssCode`, publish), and the dataset (keyed on `slug`). Areas missing from the atlas are reported, not created.

### Pipeline errors

The run fails on an unmatched name, an uncatalogued column, a missing population figure, or a malformed month header. On success it prints a report: rows read, flags by type, the 10 least complete authorities, and authorities without an atlas Area.

## UI (`apps/ui`)

### Data access

- `lib/datasets/server.ts` (`server-only`): read the bundle JSON from `public/` with `fs` in RSC — `getDatasetSummary`, `getAuthoritySeries(gss)`, `getMetric(id)`, `getCatalogue`.
- Client components fetch `metrics/*.json` lazily (explorer, metric switcher). The client never calls Strapi.
- Organisation and Dataset metadata come through new fetchers in `lib/strapi-api/content/server.ts`, respecting `draftMode()`.

### Routes

| Route | Component | Notes |
|---|---|---|
| `/organisations/[org]` | `OrganisationDetailPage` | tabs depend on `orgType` |
| `/organisations/[org]/[series]` | `DatasetDashboardPage` | latest release; `?period=` selects a release once several exist |
| `/organisations/[org]/[series]/explore` | `DatasetExplorerPage` | state held in the URL query |
| `/organisations/[org]/[series]/methodology` | `DatasetMethodologyPage` | Strapi `methodology` blocks |

Pages are statically generated (`generateStaticParams` from the Strapi organisations and bundle presence). Organisation routes sit at the top level because a segment under `/[continent]/[country]` would collide with region slugs.

### Organisation page (v2 page shell)

Breadcrumb → in-flow hero (name, type badge, related country/area, website pill) → sticky anchor nav → main column + sticky sidebar.

- **`national_body` (ACE):** About · Datasets (a card per series: title, period, coverage "129 services", national completeness, link).
- **`library_service`:** Overview · Activity · Libraries (only once the phase 5 relation exists).
  - **Activity tab:** `CompletenessBadge`; per-1,000 headline figures, each with rank among all services and among peers; a themed `TrendLine` per theme against the national median band; a `DotStrip` position per headline metric; `FormatMix` for loans; a Compare tray (up to 4 services overlaid); a link to the atlas Area page. It uses the source dataset attribution, e.g. "Source: Arts Council England, Libraries Activity Data 2023/24".
  - If the organisation has no bundle, the Activity tab is omitted.

### Dataset dashboard

1. **Headline strip** — `HeadlineSentence` × 3–4 (e.g. total loans and the digital share, visits per 1,000, events attendance), each with "based on N of 129 services".
2. **`AuthorityPicker`** — a combobox over organisation names and aliases, linking to the library-service page.
3. **Choropleth** — a `MetricPicker` plus `ChoroplethMap` of per-1,000 rates. No data and flagged values are hatched with a legend entry. Clicking an authority opens its page.
4. **Themed sections** (members, loans, visits, events, digital access) — a national `TrendLine`, a `DotStrip` of all services, an `InsightCard`.
5. Links to Explore and Methodology, plus export.

### Explorer

Filters: metric (grouped by theme), authorities (multi, or "all"), months, and raw vs per-1,000. Output: a table/chart toggle, with flagged cells marked. `ExportButton` produces CSV or JSON of exactly the filtered view, including flags and the source/licence attribution line. The URL reproduces the view.

### Components (`components/data/`)

Charts (`components/data/charts/`):

- `TrendLine` — monthly series. Missing months break the line; flagged points are hollow with hatching; there is an optional median + IQR band.
- `DotStrip` — every authority on one per-capita axis; the current authority is highlighted, peers are tinted, flagged values are hollow.
- `FormatMix` — a 100% stacked bar (physical book / audiobook / eBook / eAudio), with an age-split variant.
- `Sparkline` — for cards.
- `ChoroplethMap` — dynamically imported MapLibre, a sequential indigo ramp, hatching for no data.

Supporting components: `HeadlineSentence`, `CompletenessBadge` (percentage + icon + text), `FlagTooltip`, `AuthorityPicker`, `MetricPicker`, `CompareTray`, `ExportButton`, `InsightCard`.

Before building anything new, check `components/ds/index.ts` for existing primitives (`Badge`, `Card`, `StatBlock`, `EmptyState`, `SectionHeader`).

### Accessibility (non-negotiable)

- Every chart has a visually hidden `<table>` equivalent and an `aria-describedby` summary sentence.
- Data points are keyboard-focusable where the chart is interactive, with visible 3px indigo focus.
- Colour is never the only channel: flags use shape, hatching and text; completeness uses an icon and text.
- No transitions under `prefers-reduced-motion`.
- Filters use `fieldset`/`legend`; result counts update via `aria-live`.

### Boundaries

Only `public/boundaries/areas/greater-london.geojson` exists at area level. The choropleth needs England upper-tier (CTYUA) boundaries from the ONS Open Geography Portal (BUC, generalised), keyed by GSS code and committed as `public/boundaries/datasets/england-ctyua-2023.geojson`. The pipeline verifies that every authority GSS code has a polygon. Some ACE services cover merged or joint authorities; the map handles these through `authority-map.json`, where one service can list several GSS codes.

### Atlas hooks (phase 5)

- England country page: an "Organisations & data" section — ACE card plus 3 national headlines.
- English Area pages with a linked library-service organisation: an "Activity 2023/24" card (3 per-1,000 figures + `Sparkline`) linking to the organisation's Activity tab.
- Add the library → library-service organisation relation, and backfill it where the atlas area matches.

## Empty states and errors

- Missing bundle: dataset routes return 404; the Activity tab is hidden.
- A metric with fewer than 10 reporting services: "Too few services reported this to compare" instead of a rank or dot strip.
- An authority with no value for a metric: "Not reported to ACE for 2023/24", plus the service's free-text reason when the source provides one.
- Charts with no data render `EmptyState`, never an empty axis.

## Testing

- **Pipeline** (vitest, fixture xlsx with ~5 authorities including a constant series, blanks, a breakdown overflow and an outlier):
  - wide → long reshape, and failures on unknown columns and unmatched names;
  - each quality flag and the completeness score;
  - annual totals with the missing-month rule;
  - per-1,000 rates, national stats excluding flags, ranks and peer grouping with fallback;
  - insight rules and the `nReporting` threshold;
  - a snapshot of `summary.json` for the fixture.
- **UI:**
  - unit tests for `TrendLine` gap segmentation, scale domains ignoring flagged values, and CSV export formatting including attribution;
  - render tests for `OrganisationDetailPage` (library service with and without a bundle; national body);
  - axe checks on the dashboard and the Activity tab.

## Phasing

1. `organisation` + `dataset` content types, types regenerated, `packages/datasets` pipeline with tests, JSON bundle written, Strapi seeded (ACE + 129 services + dataset).
2. Library-service organisation page with Activity tab (`TrendLine`, `DotStrip`, `FormatMix`, `CompletenessBadge`, Compare).
3. ACE organisation page + dataset dashboard (headlines, `AuthorityPicker`, CTYUA boundaries + choropleth, themed sections, insights).
4. Explorer, export, methodology page.
5. Atlas hooks: England country section, Area-page card, library → service relation.

## Out of scope (v1)

- Postcode → authority lookup.
- Multi-year comparison UI (the model supports it; it ships with the 2024/25 release).
- Datasets from outside England or from other organisations.
- Editing observations in Strapi.
