# IMLS Public Libraries Survey (US)

Imports US public library outlets from the IMLS Public Libraries Survey (PLS), FY 2023.

- **Dataset key:** `imls-pls`. It is registered in `src/seeds/datasets.ts`.
- **Publisher:** Institute of Museum and Library Services.
- **Licence:** public domain. It is a US federal government work (17 U.S.C. § 105), and the FY 2023 documentation says "all information contained herein is in the public domain and may be used and reprinted without special permission". No credit is required, but we credit it anyway.
- **File:** `https://www.imls.gov/sites/default/files/2025-08/pls_fy2023_csv.zip`, released August 2025. The script downloads it once to `.cache/`, which is git-ignored, and writes its SHA-256 to the run log. Keep a copy of the file for any run you publish, since the survey's funding is not secure.
- **Files read:**
  - `pls_fy23_outlet_pud23i.csv`: one row per outlet, 17,586 rows.
  - `PLS_FY23_AE_pud23i.csv`: one row per library system. It supplies the legal basis and the system name.

## Running it

From `apps/strapi`:

```bash
# Map and report only. Needs no Strapi and no token.
npx tsx scripts/ingests/usa/imls-pls/ingest.ts --dry-run --state=NY

# Also find every outlet's Region and Area, read only: run this before a live run
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… npx tsx scripts/ingests/usa/imls-pls/ingest.ts --dry-run --state=CT,VA

# Create drafts: New York, 25 at a time
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… npx tsx scripts/ingests/usa/imls-pls/ingest.ts --state=NY --limit=25
```

Both values are in `apps/strapi/.env`. Without the bridge secret Strapi ignores `?status=draft` and every write publishes, so the client refuses to start.

Records go in as drafts. Every library gets `source: "imls-pls"` and a source record `{ dataset: "imls-pls", recordId: "<FSCSKEY>-<FSCS_SEQ>" }`. An outlet that already has a source record is reported as `exists` and left alone, so re-running is safe. The first live run against an empty atlas creates North America → United States (a Country with region label "State") and each state as a Region.

## Places

Each outlet's Region and Area are found in the atlas (`places.ts`), which the gazetteer has usually filled already, so a run should create no places at all. The run's `Places:` list shows every one found other than by slug, and anything created.

1. **By slug:** `schuyler-county-ny`.
2. **By name** (`_shared/place-match.ts`): case, accents, punctuation and spacing are ignored, "St." is "Saint", and words like County, Parish, City and Census Area are dropped. So "ST. JOHNS" finds Saint Johns County, "LA SALLE" LaSalle County and "ALEXANDRIA" City of Alexandria. When a city and a county share a name (Virginia's Richmond), only a name that says which counts.
3. **By point:** the Census Bureau geocoder gives the county at the outlet's coordinates (`../census-county.ts`, cached in `.cache/census-counties.json`). This settles Connecticut, whose survey rows still name its eight old counties, which the Census Bureau replaced with nine planning regions in 2022 (the atlas has the planning regions); Alaska's abbreviated and since-split boroughs; and rows with a city in the county column ("MCALESTER").

An Area is created only for a county that the survey and the geocoder agree on and the atlas lacks. When the point is in another state, as the Texarkana library and Bristol's Avoca branch are, the library gets its Region and no Area.

The territories (PR, VI, GU, MP, AS) are Countries of their own in the atlas, as in ISO 3166 and GeoNames. Their Regions come from the county column (Guam's from the city column, since its county column says "GUAM") and are never created. Montana's Region is `montana-us`, because `montana` is Bulgaria's. The District of Columbia has no Areas.

## Column → field

| PLS column                 | Library field                         | Rule                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FSCSKEY` + `FSCS_SEQ`     | `sourceRecords[].recordId`            | For example `NY0001-002`. This pair stays the same for an outlet from year to year.                                                                                                                                                                                                                                           |
| `LIBNAME`                  | `name`                                | Converted from capitals to normal case. A branch or bookmobile named only by its place gets the system name first: "Brooklyn Public Library, McKinley Park". The system name is cut at its first comma, because NYPL's is "…, THE BRANCH LIBRARIES". A bookmobile filed under its library's own name gets "Bookmobile" added. |
| `LIBNAME`, `CITY`, `STABR` | `slug`                                | Name, then the city unless the name already has it, then the state: `powers-library-association-moravia-ny`. Library pages look libraries up by slug alone, so the slug must be unique across the whole index. A clash gets the outlet sequence added.                                                                        |
| `C_OUT_TY`                 | `libraryType`                         | `CE` (central) and `BR` (branch) → Public. `BS` (bookmobile) → Mobile. `BM` (books by mail) is skipped, because it isn't a place to visit.                                                                                                                                                                                    |
| `STATSTRU`                 | `operationalStatus`                   | `23` → temporarily_closed. `25` (didn't answer the survey) → unknown. Everything else → open, as of FY 2023.                                                                                                                                                                                                                  |
| AE `C_LEGBAS`              | `operatorType`                        | City, city/county, multi-jurisdictional, library district and school district → Municipality. County/parish → Regional Government. Non-profit → Independent. Tribal and other → Other.                                                                                                                                        |
| `ADDRESS`, `CITY`, `ZIP`   | `streetAddress`, `city`, `postalCode` | Converted to normal case. Five-digit ZIP only.                                                                                                                                                                                                                                                                                |
| `PHONE`                    | `phone`                               | Ten digits become `(607) 535-7489`. Negative codes mean no value.                                                                                                                                                                                                                                                             |
| `LATITUDE`, `LONGITUD`     | `location`                            | IMLS geocoded every outlet. The run log flags scores under 90.                                                                                                                                                                                                                                                                |
| `STABR`                    | `timezone`, Region                    | The time zone comes from `../states.ts`. It is left empty in the 16 states that span more than one zone. A territory has its own zone and Country.                                                                                                                                                                            |
| `CNTY`                     | Area                                  | Matched to the atlas's Areas (see Places). A new one is named "Schuyler County" (Parish in LA, Borough in AK, cities such as "Richmond City" in VA), its slug carrying the state (`washington-county-ny`) because county names repeat across states. In a territory, `CNTY` names the Region.                                 |
| `HOURS`, `SQ_FEET`         | `libraryStats`                        | Used only when the flag starts `R_` (reported). Imputed values are dropped.                                                                                                                                                                                                                                                   |

`website`, `email` and opening hours aren't in the survey. State datasets, or a later crawl, can add them to these records by their source record.

## Known gaps

- A library just across a state line from its system's state (Texarkana, Bristol) stays under the survey's state, with no Area.
- Some names keep the survey's own abbreviations, such as "Pickaway Cnty District Public Library".
- Several bookmobiles in one system can share a name, for example two "Alameda County Bookmobile" rows. Their slugs are kept apart by the outlet sequence.
- FY 2023 ended in mid-2023. "Open" means open in that survey year.

## FY 2023 dry run (all states)

17,586 outlets: 17,584 mapped and 2 skipped (books-by-mail), 127 of them in the territories. 3,089 areas before matching. New York alone: 1,083 outlets in 62 counties.
