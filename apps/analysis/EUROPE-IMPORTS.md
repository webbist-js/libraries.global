# Ireland and Italy source preparation

`prepare_europe_sources.py` downloads, validates and stages context observations.
It never activates a layer, builds a routing graph or writes CMS records. Each
source has a SHA-256 checksum, URL, retrieval time, publisher and licence in the
readiness report. Files stay under ignored `data/europe-staging/`.

From `apps/analysis`, using the existing virtual environment:

```sh
.venv/bin/python prepare_europe_sources.py ireland
.venv/bin/python prepare_europe_sources.py ireland --offline
.venv/bin/python prepare_europe_sources.py italy --region=02
.venv/bin/python prepare_europe_sources.py italy --region=02 --offline
# Process all twenty Italian regions sequentially:
.venv/bin/python prepare_europe_sources.py italy --region=all --offline
```

`--refresh` replaces source snapshots; it cannot be combined with `--offline`.
The Italian archive is about 249 MiB and is capped at 256 MiB. Regional XLSX
worksheets are streamed one at a time. Region 02, Aosta Valley, is the default
pilot. Selecting one region never reports national coverage. Missing or
suppressed counts remain unknown; malformed counts and duplicate codes fail.

## Ireland

The [CSO Census 2022 electoral-division CSV](https://www.cso.ie/en/census/census2022/census2022smallareapopulationstatistics/)
contains 3,420 areas and one national total. Population and household counts
must reconcile exactly to that total. CSO statistics are
[CC BY 4.0](https://www.cso.ie/en/aboutus/whoweare/copyrightpolicy/).

Car availability uses `T15_1_NC / T15_1_TC`. The script retains `T15_1_NSC`
separately and verifies that all six categories sum to the household denominator.
Not stated is not known ownership. This is a household measure, not a share of
people, and differs from a percentage calculated only over stated responses.

[Pobal HP 2022](https://data.gov.ie/dataset/pobal-hp-deprivation-index-scores-2022)
uses 3,417 electoral-division codes under CC BY 4.0. The script uses the official
[Tailte Éireann boundary crosswalk](https://data-osi.opendata.arcgis.com/datasets/osi::cso-electoral-divisions-national-statistical-boundaries-2022-ungeneralised),
also CC BY 4.0, to connect those codes to census GUIDs. It preserves the Cork
2019 suffixes and normalises dropped leading zeroes. It never joins on names.

Three codes each correspond to two census GUIDs: `047298`, `147008` and `147019`.
The script groups their population before comparing it with Pobal. The local
source check reconciled all codes and populations. Deprivation boundaries must
union the member GUIDs; do not count the Pobal population twice or assign a score
as though it were independently observed for each half.

`observations.json` contains census areas and separate deprivation groups.
`readiness.json` lists missing codes, population disagreements and split groups.
Pobal's relative score is retained as published. Lower scores mean greater
deprivation. No UK-equivalent ranks or deciles are invented.

## Italy

The [Istat 2023 census-section archive](https://www.istat.it/notizia/dati-per-sezioni-di-censimento/)
uses 2021 section geography and is covered by Istat's
[CC BY 4.0 terms](https://www.istat.it/note-legali/). The script verifies all twenty
regional workbooks are present, preserves the publisher's variable dictionary,
and writes the selected regions as `population-NN.ndjson`.

`P1` is resident population, `PF1` is resident households and `NA1` is owned
automobiles. **NA1 cannot supply a household-without-car percentage.** The report
marks that layer unsupported. Population sex totals are reconciled row by row;
independent administrative totals and boundary joins are checked by
`prepare_italy_admin.py` below.

The section code retains its 2021 municipality prefix. The source's `PROCOM`
can differ after a municipal merger; both codes are preserved and the report
counts these changes. Boundary joins must use the section code, not rewrite it
to match the newer municipality.

Sections whose final seven digits start with `888888` or `999999` are marked
nonspatial. Their people remain in totals, but must not be attached to an invented
polygon. The Aosta pilot found nine such sections containing 68 residents. The full
twenty-region check staged 493,942 sections and 58,971,230 residents, including
2,145 nonspatial sections with 86,728 residents. It found 57 section records
whose municipality codes changed. These are source-validation results, not
proof of installed Atlas coverage.

A nationwide deprivation edition has not been accepted. Istat's
[IDISE releases](https://www.istat.it/statistiche-per-temi/censimenti/popolazione-e-abitazioni/risultati/)
have limited city coverage; they must not be described as a national layer.

## Before activation or production import

The source-stage report deliberately keeps `readyForActivation: false`: it is not
an activation check. Boundary geometry, administrative ownership, rasters, routing
graphs and analytical indexes each need their own acceptance. Each activation must record its own private acceptance evidence. Directory coverage
and analytical coverage are separate.

For local CMS testing, reuse the existing database and one CMS server. First run
each Library adapter with `--local --check-cms`, then a small `--local --apply
--limit=5` batch. Read back the drafts and Source Records, replay the same snapshot
to verify no duplicates, and check that import creates produce no Library Change
Records after the corresponding release is installed. Do not publish test drafts.
`--limit=5` means five new records: repeating that command advances to the next
batch. Use `--check-cms` for a read-only replay, or replay exactly the previously
created record set through the shared draft writer to test write idempotency.
Production uses the private content-operations workflow after release acceptance.

## Atlas layer preparation

The source staging commands above remain read-only with respect to active layers.
`prepare_europe_context.py` builds indexed context assets. `--install` performs
point and non-transparent tile checks before replacing the matching entries in
the local context catalogue. Other countries remain installed.

```sh
# Irish census car availability and published Pobal categories:
.venv/bin/python prepare_europe_context.py --root data --install
# Replay all source and geometry snapshots without network access:
.venv/bin/python prepare_europe_context.py --root data --offline

# Native GHSL surfaces for density maps and Reach; run sequentially:
.venv/bin/python prepare.py population --root data --profile profiles/ireland.json --apply
.venv/bin/python prepare_europe_context.py --root data --population ireland --install
.venv/bin/python prepare.py population --root data --profile profiles/italy.json --apply
.venv/bin/python prepare_europe_context.py --root data --population italy --install
```

Ireland's boundary loader checks an independent object-ID inventory and all
3,420 census GUIDs. The official service currently emits malformed GeoJSON for
some polygons and omits others. Those pages are re-requested as native ArcGIS
rings, with the same IDs and WGS84 output. Conversion follows Esri's even-odd
fill rule, preserving holes and nested islands. Missing geometry fails the run.
The original responses and checksums remain in the source cache.

The deprivation map has 3,417 reporting divisions, with split census geometries
unioned before publication. It displays the eight published Pobal categories
and relative scores. Category numbers are palette keys, **not deciles, ranks or
comparable UK scores**. Full source boundaries are retained; display geometry
is simplified by the existing context pipeline. The car layer preserves the
nonresponse count alongside its numerator and denominator.

Population surfaces use GHS-POP 2020 R2023A at native 100 m resolution. They
include a geographic buffer, so the sum of an entire raster is not a national
population total. Display overviews are separate copies; Reach uses the original
population cells. These surfaces do not replace the staged official 2022/2023
census observations or install administrative population ownership.

Ireland's Reach profile reuses the whole-island graph already prepared for
Northern Ireland, with its own west-coast-complete population surface. Activate
with `prepare.py activate`, the Ireland profile and the matching graph/population
manifests. Activation verifies asset hashes and walking/cycling canaries in Dublin,
Cork, Galway and Letterkenny. A graph manifest's name is not its coverage boundary.

Italy's profile requires Italy, Rhône-Alpes, Provence-Alpes-Côte d'Azur,
Switzerland, Austria and Slovenia routing extracts. `routing_buffer.py` compacts
each input, merges sorted objects by type and ID, and retains the highest version
of duplicates. Every source URL/hash is retained in the merged manifest. The
merge streams objects and the native build uses one worker with a disk reserve.
Activation refuses a graph missing the declared neighbouring sources. City,
island and border canaries must pass before installing the profile. The
Breuil-Cervinia coordinate follows the [regional monitoring station](https://presidi2.regione.vda.it/str_dataview_station/3590),
rather than a point on the mountain massif.

```sh
.venv/bin/python prepare.py network --root data --profile profiles/italy.json --apply
# Use the network.json path printed by the completed build:
.venv/bin/python prepare.py activate --root data --profile profiles/italy.json \
  --graph-manifest PATH_TO_NETWORK_JSON \
  --population-manifest data/releases/ghsl-2020-r2023a-100m-italy-v1/population.json --apply
```

Remaining coverage gaps are explicit: Italy still lacks an accepted nationwide
household-no-car source and deprivation edition. Istat's
[IDISE methodology](https://www.istat.it/wp-content/uploads/2025/12/Nota-Informativa-idise-2023.pdf)
limits comparisons to areas within the same municipality and year, so combining
its city releases into a national ranking would be invalid. The October 2026
update supplies 2023 submunicipal results for 161 municipalities and additional
elementary municipal indicators; those do not constitute a published national
composite deprivation index. Irish administrative population ownership still needs further joins.
Network-wide community Reach currently accepts UK district codes and national
decile groups only; the Irish category map does not enable that separate feature.

## Italian province matching and administrative density

Province aliases reconcile bilingual and metropolitan names within their parent
Region. Matching rejects ambiguity and does not rewrite already imported records.
Run target-specific preflight before importing; source identity checks preserve
existing libraries.

`prepare_italy_admin.py` aggregates complete 2023 census observations using their
current municipality/province codes, joins the official 1 January 2024 Istat
boundaries, and verifies 20 Regions, 107 provinces and 58,971,230 residents.
Nonspatial census sections contribute to administrative totals without inventing
section geometries. Source checksums, vintage and CC BY 4.0 attribution are kept.

```sh
# From apps/analysis, after preparing the Italian census sources:
.venv/bin/python prepare_italy_admin.py --root data --install
# From apps/strapi; defaults to preflight, writes only with --apply:
pnpm ingest --dataset=it-census2023 --local
pnpm ingest --dataset=it-census2023 --local --apply
```

The Italian routing downloader uses four bounded HTTP range connections only
when a server supplies byte ranges and a strong ETag. Every response must match
the requested range and unchanged ETag before the completed file is published.
Compaction, merging and graph construction remain sequential.

Context preparation supports offline replay from retained source snapshots. The
population selector includes installed grids even when a country has no
administrative layer; requesting an unavailable level explains the gap and
retains the active selection. Italy's local administrative level is labelled Provinces.

## Explaining Atlas coverage gaps

Atlas opens a data-gap dialog when an active analysis encounters unavailable
coverage, missing area/population values, partial routing, unavailable community
comparisons or unconfirmed accessibility records. It identifies the layer and
selected scope, retains available results, and explains that missing data is
unknown rather than zero. Counts of recorded libraries also explain that directory
completeness is unverified.

Dismissal applies to the current encounter. Selecting another location, reopening
an analysis or requesting an unsupported population level explains the gap again;
the “Data gap details” button also reopens it. Routine rerenders do not reopen a
dismissed dialog. Unsupported population levels retain the current selection.
Loading states do not produce a missing-data warning; retrieval failures have a
separate explanation. Context layers require an explicit edition when geographic
bounds overlap rather than silently selecting a different country's data.

Accepted context releases can include `coverage: { status: "partial", gaps: [...] }`
with specific, human-readable source limitations. These explanations are displayed
verbatim as text. This metadata does not bypass acquisition or validation checks:
a partial source must still meet its declared coverage and retain its source,
licence and vintage. Do not infer completeness from the absence of this metadata.
Ireland retains Pobal's published deprivation categories.

Local regression checks cover gap classification, genuine zero values, edition
ambiguity, dialog dismissal/reopening and unsupported population choices. The
mechanism does not waive import or release acceptance requirements.
