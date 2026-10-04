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

# Create drafts: New York, 25 at a time
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… npx tsx scripts/ingests/usa/imls-pls/ingest.ts --state=NY --limit=25
```

Both values are in `apps/strapi/.env`. Without the bridge secret Strapi ignores `?status=draft` and every write publishes, so the client refuses to start.

Records go in as drafts. Every library gets `source: "imls-pls"` and a source record `{ dataset: "imls-pls", recordId: "<FSCSKEY>-<FSCS_SEQ>" }`. An outlet that already has a source record is reported as `exists` and left alone, so re-running is safe. The first live run creates North America → United States (a Country with region label "State"), then each state as a Region and each county as an Area.

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
| `STABR`                    | `timezone`, Region                    | The time zone comes from `../states.ts`. It is left empty in the 16 states that span more than one zone.                                                                                                                                                                                                                      |
| `CNTY`                     | Area                                  | "Schuyler County" (Parish in LA, Borough in AK, and cities such as "Richmond City" in VA). The slug carries the state (`washington-county-ny`) because county names repeat across states.                                                                                                                                     |
| `HOURS`, `SQ_FEET`         | `libraryStats`                        | Used only when the flag starts `R_` (reported). Imputed values are dropped.                                                                                                                                                                                                                                                   |

`website`, `email` and opening hours aren't in the survey. State datasets, or a later crawl, can add them to these records by their source record.

## Known gaps

- Outlying areas (PR, VI, GU, MP, AS: 127 outlets) are skipped until we decide whether they go under the United States or become countries of their own.
- Some names keep the survey's own abbreviations, such as "Pickaway Cnty District Public Library".
- Several bookmobiles in one system can share a name, for example two "Alameda County Bookmobile" rows. Their slugs are kept apart by the outlet sequence.
- FY 2023 ended in mid-2023. "Open" means open in that survey year.

## FY 2023 dry run (all states)

17,586 outlets: 17,457 mapped and 129 skipped (127 outlying areas, 2 books-by-mail). 16,742 are Public and 715 Mobile. 3,089 areas. New York alone: 1,083 outlets in 62 counties.
