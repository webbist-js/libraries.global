# Scandinavian ingests

Run from `apps/strapi`. These adapters use Wikidata's CC0 library facts and national statistical APIs for geography and population. Finland has its own [Kirkanta adapter](../finland/kirjastot-fi/README.md).

```bash
pnpm ingest --dataset=wikidata --country=SE
pnpm ingest --dataset=wikidata --country=SE --check-cms
pnpm ingest --dataset=wikidata --country=SE --apply --limit=25
pnpm ingest --dataset=wikidata --country=SE --apply --concurrency=3

# Repeat with --country=NO or --country=DK
# Replay saved inputs without downloading them:
pnpm ingest --dataset=wikidata --country=DK --snapshot=scripts/ingests/nordics/dk/.cache --check-cms
```

The default is a dry run without CMS or database access. `--check-cms` adds read-only reconciliation. `--apply` writes library drafts and missing place drafts, and stores population observations on matched geographic documents. Existing library Source Records, place text, publication state and older population observations are preserved. `--limit` counts new libraries; geography and population are always validated in full.

Writes are sequential by default. `--concurrency=1..4` bounds simultaneous library creates. After a failed request, the runner stops dispatching new records and waits for in-flight requests to finish and checkpoint before exiting. Rerun to reconcile Source Records, including any committed create whose response was lost. Countries still run sequentially under the Dataset lock.

## Sources and reuse

| Country | Geographic coverage                          | Population source                                                | Licence   |
| ------- | -------------------------------------------- | ---------------------------------------------------------------- | --------- |
| Sweden  | 21 counties, 290 municipalities              | SCB `BefolkningCKM`, 31 December 2025                            | CC0 1.0   |
| Norway  | 15 counties, 357 municipalities              | SSB `07459`, 1 January 2026; Klass `104` and `131` at 2026-01-01 | CC BY 4.0 |
| Denmark | 5 regions, 98 municipalities and Christiansø | StatBank `FOLK1A`, 2026Q1                                        | CC BY 4.0 |

Library facts come from [Wikidata structured data, CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing). Every imported library links to its Q entity. Sweden's municipality name aliases and Denmark's municipality-to-region links also come from Wikidata. Norwegian county membership follows the current official municipality code prefix.

Publisher terms: [Statistics Sweden](https://www.scb.se/en/services/open-data-api/), [Statistics Norway](https://www.ssb.no/en/api/pxwebapiv2), [Statistics Denmark](https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api). The `wikidata`, `scb-population`, `ssb-population` and `dst-population` Dataset records retain these terms and the credits. Population observations carry their own publisher, table URL, licence, retrieval date, reference date and boundary vintage.

The Swedish, Norwegian and Danish national library directories were reviewed. Public access and an API were not treated as a redistribution licence: this adapter imports no directory records from Libris Biblioteksdatabasen, BaseBibliotek or DBC VIP. A future adapter can replace or supplement this baseline once the relevant reuse terms are established. Wikidata is a partial knowledge graph and does not establish a library's present operation or visitor access.

## Mapping

| Source fact                                                | Stored field                    | Rule                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Wikidata Q identifier                                      | `sourceRecords.recordId`        | Group all SPARQL rows for one Q ID; do not create one library per row                                                    |
| Native-language label, then English                        | `name`                          | Preserve the source label; skip missing labels                                                                           |
| Library class ancestry                                     | `libraryType`                   | Mobile, National, University, Academic, Public or Special when an explicit recognized class supports it; otherwise Other |
| Municipality claim ancestry and national municipality code | Country, Region, Area relations | Match only current official codes; skip ambiguous current municipalities                                                 |
| WGS84 point                                                | `location`                      | One usable pin within mainland-country bounds; omit conflicting or invalid pins                                          |
| Official website                                           | `website`                       | One valid HTTP(S) URL                                                                                                    |
| Native-language full address                               | `streetAddress`                 | Preserve the full address; do not infer postal code or city from free text                                               |
| Entity URL                                                 | `sourceUrl`                     | Link to the record, including for country-only placement                                                                 |
| Knowledge-graph record                                     | `operationalStatus`             | Unknown; no live opening status or permanent closure inferred                                                            |

Known dissolved institutions, digital libraries and library networks are excluded by the query. A library needs a readable name and either a current municipality or usable coordinates. A pin without a municipality is imported at country level with a warning; no nearest-town assignment is made. Images, descriptions, staff contacts and opening schedules are not imported.

The initial validated snapshots map 2,496 Swedish, 663 Danish and 64 Norwegian libraries. They omit 44, 10 and 20 records respectively, with a reason for each in the run log. The actual import added **3,222 library drafts**: 2,496 in Sweden, 663 in Denmark and 63 in Norway. The shared Nordic bookmobile [Q72211917](https://www.wikidata.org/wiki/Q72211917) occurs in both Sweden and Norway; its global Source Record identity keeps one document, first placed in Sweden. It is classified Mobile from its explicit bookmobile ancestry. A separate cached classification query supplies mobile types without adding institutions outside the validated library set; service areas and base coordinates do not establish mobile stops or timetables.

Immediately after the initial import, 124 of the 3,222 stored documents had country-only placement and 172 lacked usable coordinates. These counts describe this snapshot, not national library coverage. Subsequent source-verified geographic changes are recorded in [reviewed corrections](corrections.md). All three completed imports pass a read-only replay with zero pending library or place creates. The import also stores 790 population observations and adds 156 missing Norwegian geographic drafts (four counties and 152 municipalities). Finland and Åland add another 976 libraries through their separate adapter, for **4,198 library drafts** across this batch.

## Population checks

JSON-stat dimensions, category indices, selected totals, reference periods and every cell must be complete. Norway sums all 106 disjoint age categories for both sexes; zero-valued age cells are valid, missing or suppressed cells stop the run. Norway and Denmark must reconcile exactly from areas to regions to country.

SCB applies Cell Key Method disclosure control from 2025. The table explicitly warns that totals can differ from component sums. The adapter preserves published totals and records the discrepancies and disclosure-control note. In this snapshot, the sum of Swedish county figures differs from the published national figure by six people; individual county discrepancies are at most nine. These differences are not corrected by replacing source totals.

Christiansø is an administrative reporting area outside Denmark's 98 municipalities. FOLK1A includes it in Hovedstaden. Its observation retains that coverage; a newly created place uses the type label Administrative area. Denmark's planned 2027 regional structure is not applied to 2026 data. Åland, Svalbard/Jan Mayen, Greenland and the Faroe Islands remain separately catalogued ISO entries.

## Repeatability and review

Finland and these three adapters share `_shared/execute.ts`: place planning, global slug checks, Dataset registration, geographic population storage, library writes, advisory locks and checkpoints. Missing records are created as drafts. A failed write stops the run; rerunning reconciles Source Records before continuing, including a create that committed before its response was lost. No existing library is refreshed over contributor edits.

Each country keeps request metadata, retrieval dates and SHA-256 checksums in `.cache/`; each plan or apply run has a report in `.runs/`. Keep both for any published import. `--refresh` downloads new snapshots; the fixed population vintages and expected administrative counts remain explicit, so a changed hierarchy requires an adapter review.

Existing Swedish and Danish places are reused, including verified alternate spellings and municipality suffixes. Norway reuses current places where the parent agrees, adds missing current counties and municipalities, and reports eight obsolete county entries for review. The existing malformed county name `Ãstfold` is matched to code `31` through an explicit seed alias; its text remains an editorial correction. The adapter does not delete or reparent legacy documents.

Review the drafts and uncertain types, publish approved records, then run the existing Meilisearch reseed. Country-only records, missing coordinates and Norway's sparse library coverage are useful contributor tasks.
