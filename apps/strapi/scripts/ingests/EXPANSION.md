# Prepared library imports: nine countries

These adapters are implemented separately. They have not been run against source
exports or a CMS as part of their preparation. Unit tests use small fixtures;
they do not establish live coverage, reconciliation or publication acceptance.

Run commands from `apps/strapi` when the imports are authorised. There is no
batch command. Austria has two independent datasets, giving ten commands for
nine countries. Every command defaults to local file preparation without CMS
access. No command publishes libraries, creates places or changes population.

| Country         | Dataset argument        | Source format        | Mapping and source instructions               |
| --------------- | ----------------------- | -------------------- | --------------------------------------------- |
| Latvia          | `lv-kisc-libraries`     | CSV                  | [KISC](latvia/kisc/README.md)                 |
| Taiwan          | `tw-nlpi-libraries`     | Grouped JSON         | [NLPI](taiwan/nlpi/README.md)                 |
| Singapore       | `sg-nlb-libraries`      | GeoJSON              | [NLB](singapore/nlb/README.md)                |
| Belgium         | `be-fwb-libraries`      | Full JSON export     | [FWB](belgium/fwb/README.md)                  |
| Austria: Vienna | `at-vienna-libraries`   | WFS GeoJSON          | [Vienna](austria/vienna/README.md)            |
| Austria: Graz   | `at-graz-libraries`     | ArcGIS JSON in WGS84 | [Graz](austria/graz/README.md)                |
| Brazil          | `br-snbp-cadastro`      | Original XLSX        | [SNBP](brazil/snbp-cadastro/README.md)        |
| Netherlands     | `nl-wikidata-libraries` | SPARQL JSON          | [Wikidata NL](netherlands/wikidata/README.md) |
| New Zealand     | `nz-wikidata-libraries` | SPARQL JSON          | [Wikidata NZ](new-zealand/wikidata/README.md) |
| Kenya           | `ke-alva`               | ALVA April 2022 CSV  | [ALVA](kenya/alva/README.md)                  |

## Source acquisition

Save the complete publisher export under the adapter's ignored `.cache/`
directory, with its actual UTC retrieval timestamp and the publisher's licence
evidence. Acquisition is deliberately separate from ingestion: these adapters
never fetch a live source or silently replace a saved file. A future HTTP error
page must not be saved as data. Verify the download's content type and schema.

The URL and expected format for each source are in
[`_shared/expansion-feeds.ts`](_shared/expansion-feeds.ts). Singapore's URL is a
download-discovery endpoint: save the GeoJSON at the returned URL, not the poll
response. For Belgium use `exports/json`, not a paginated `records` response.
For Wikidata use the checked-in country query: the country binding is required,
and the query has no LIMIT. Save the full SPARQL JSON response, not CSV or a
browser preview. Keep query text with the export.

Check completeness independently of the file's length. For example, compare
Belgium's export with the catalogue's `total_count`; Graz with a separate
`returnCountOnly=true` request; Wikidata with a distinct-identifier query using
the same country/class/exclusion clauses. Vienna's reported feature counts are
also checked by the parser. For Taiwan and Latvia compare the full publication
and its groups/categories. Record differences from earlier snapshots and
investigate large drops before approving a review. Review data vintage, not
only the catalogue modification date.

## Prepare one dataset

Example for Latvia; substitute any dataset and its saved file from the table.
The timestamp below is illustrative: use the file's actual retrieval time.

```sh
pnpm ingest --dataset=lv-kisc-libraries \
  --file=scripts/ingests/latvia/kisc/.cache/objektusaraksts.csv \
  --retrieved-at=2026-11-07T12:00:00Z
```

This writes two private files under that adapter's `.runs/`:

- `<checksum-prefix>.candidates.json`: mapped facts, source checksum, source
  coordinates where available, geography hints and warnings.
- `<checksum-prefix>.review-template.json`: every candidate starts as `review`.
  Repeated preparation does not overwrite this file. Copy it to `review.json`
  before editing.

No CMS/database connection is made during this step. The file checksum is
recomputed on every invocation. Brazil's workbook reader uses Python 3's
standard library and rejects formulas, ambiguous worksheets and oversized
uncompressed workbooks; no spreadsheet dependency needs installing.

## Complete the review

The review must match the dataset, full SHA-256, retrieval timestamp and exact
candidate ID set. It needs a checked count, completeness explanation, licence
evidence URL and `reconciledAgainstCms: true`. Set the latter only after a
read-only reconciliation against existing published **and draft** records.
Compare other source datasets too, especially existing Wikidata identities.

For each candidate choose one action:

- `import`: give the exact existing CMS `regionName`, optionally `areaName`, and
  a supported physical `libraryType`. Geography hints are not automatically
  promoted into relations. Country scope is fixed by the dataset. The shared
  writer resolves names under their country/region, rejects ambiguous regions
  and quarantines contradictory area parents. Missing areas may remain unset.
- `skip`: give a reason. Use this for duplicates, existing curated libraries,
  closed/non-library institutions, administrative operators, digital libraries,
  mobile services or uncertain rows. Existing curated records are preserved;
  this adapter does not attach a new source to them or overwrite their fields.

School libraries currently map to `Other` because the shared catalogue has no
School type. Review broader source categories, especially Belgium and Graz.
Never infer public access from the source's use of the word “library”. Mobile
services require a separate model and are excluded from these fixed-site imports.

For Latvia, Taiwan, Singapore, Belgium and Austria, a nonempty
`coordinateEvidence` URL opts a row into its **original, bounds-checked source
point**. Leave it absent to import without a pin. Confirm the publisher owns or
can license the point: a map's base tiles do not establish how a point was
created. Review cannot supply arbitrary replacement coordinates. Brazil,
Netherlands, New Zealand and Kenya always omit coordinates. LINZ geocoding is a
separate future enrichment, not implemented by these imports.

Synthetic IDs are documented per source. Name/address changes create a new
candidate identity and must be reconciled rather than blindly imported as a new
branch. The review is required for every source snapshot, including refreshes.
All imported operation statuses remain `unknown`; prose, images, personal email
contacts and free-text schedules are not imported.

## Validate and later apply separately

After completing the review, first validate it offline:

```sh
pnpm ingest --dataset=lv-kisc-libraries \
  --file=scripts/ingests/latvia/kisc/.cache/objektusaraksts.csv \
  --retrieved-at=2026-11-07T12:00:00Z \
  --review=scripts/ingests/latvia/kisc/.runs/review.json --dry-run
```

When authorised, add `--check-cms` with an explicit `--local` or `--production`
target using the existing operator connection. This checks geography, source
identities and slugs without creating libraries. The review is validated before
the directory pipeline can access the CMS. Do not substitute local data for an
unavailable production connection.

Only a subsequent authorised `--apply` invocation writes drafts. Start with
`--limit=5 --concurrency=1`, inspect those drafts, then resume the same source and
review. The existing shared writer provides a per-dataset lock, source-record
identity lookup, checkpoints, bounded concurrency and preservation of existing
source records. An exact replay skips previously created records. A missing or
different registered Dataset licence/source blocks writes. The new Dataset
seeds are created on the normal CMS seed lifecycle; this work does not restart
or deploy the CMS to register them.

Publication and search indexing remain separate operations. Licence/source
checks, full-source dry runs, production reconciliation and small-write
acceptance have **not** been performed for these adapters.
