# Dataset ingests

Each ingest imports one registered Dataset (see `CONTEXT.md`). Ingests are grouped by country:

```
ingests/
  _shared/     Sources, validation, place planning, population storage, draft writes, resume
  finland/     Kirkanta libraries, current municipalities and official population
  nordics/     Wikidata libraries with Swedish, Norwegian and Danish population
  usa/         states.ts (every US ingest), plus one folder per dataset
    imls-pls/
```

The LibraryOn ingest is still at `scripts/libraryon-ingest.ts` and has yet to move to `uk/libraryon/`.

## One entry point

Run from `apps/strapi`. The runner reads that application's `.env` without printing credentials and defaults to a dry run. `--apply` enables writes.

```bash
pnpm ingest --dataset=kirjastot-fi
pnpm ingest --dataset=kirjastot-fi --check-cms
pnpm ingest --dataset=kirjastot-fi --apply --limit=25
pnpm ingest --dataset=kirjastot-fi --apply
pnpm ingest --dataset=wikidata --country=SE --check-cms
pnpm ingest --dataset=wikidata --country=NO --apply
pnpm ingest --dataset=wikidata --country=DK --apply

# Existing adapters retain their own flags and mapping rules
pnpm ingest --dataset=imls-pls --state=NY
pnpm ingest --dataset=libraryon --country=scotland
pnpm ingest --dataset=gazetteer --country=CH
```

Finland and the [Scandinavian adapters](nordics/README.md) run the full sequence through `_shared/execute.ts`: snapshot → validate geography and population → map every Library → compare with the CMS → create missing place drafts → enrich population → create missing Library drafts. The existing adapters are dispatched by the same runner; their write loops have not been migrated.

The shared helpers cover cached JSON snapshots with request metadata and SHA-256 checksums, complete paginated downloads, duplicate and slug checks, checkpoints after each Library write, and population storage on explicitly matched geographic documents. Existing Source Records are skipped, including when their Libraries have been edited by contributors. A failed create stops the run: re-running reconciles with the CMS instead of retrying a request that may already have committed. A Dataset lock prevents concurrent writes from the same Dataset; run the three Wikidata countries sequentially.

Use `--snapshot=<saved-cache-directory>` to replay Finland or a Scandinavian country offline and `--refresh` to fetch new snapshots. Keep the cache and the `.runs/` report for every import that is published. `--limit` counts new Library drafts; it does not truncate the country's geography or population validation.

Library creates default to one request at a time. `--concurrency=1..4` enables bounded parallel writes for Finland and Wikidata. On a failure, new dispatch stops and in-flight requests settle and checkpoint before the run exits. Resume with the same inputs to reconcile any response lost after a commit.

Before launch, review and publish new drafts, then run the existing Meilisearch reseed. The report lists legacy places that need editorial review. Finland's old provinces and Lapland subregions remain untouched; the adapter creates the current Regions and Municipalities alongside them and uses only the current hierarchy for new Libraries. The general GeoNames importer still uses its existing Finland profile and should not be used to refresh Finland's current hierarchy.

## Adding one

1. Check the licence allows republication under CC BY-SA 4.0 (see CONTRIBUTING.md, Provenance), then add the dataset to `src/seeds/datasets.ts`.
2. Make a folder `<country>/<dataset-key>/` with:
   - `source.ts`: fetch through `_shared/json-source.ts`, retaining the request, retrieval date and checksum. Make the dataset's IDs and completeness checks explicit.
   - `map.ts`: pure functions from a source row to library fields and geography. It does no I/O, so it can be unit tested.
   - `geography.ts`: prepare current `SourcePlace` entries with stable official codes, explicit parents, population observations and source licences. Validate coverage and aggregate reconciliation before writes.
   - `ingest.ts`: prepare the source, mapped libraries and geography, then call `_shared/execute.ts`. Reuse its dry run, read-only CMS preflight, locks, place matching, population storage and resumable draft writes. Add the adapter to `run.ts`.
   - `README.md`: the licence, the file and its URL, and a column → field table with the reason for every rule.
3. Give every library `source: "<dataset-key>"` and pass its source ID as `recordId` to the shared runner, which stores the `sourceRecords` entry. `StrapiClient.librariesBySourceRecord()` loads the existing matches globally within a Dataset, so a re-run skips what's already there, including cross-country records. Omit unsupported facts with a warning rather than inventing values.
4. Put tests for `map.ts` in `tests/ingests/`.
5. Dry-run first and read the run log (`*.ingest-log.json`, git-ignored). Then do a small live run with `--limit` and check the drafts in the admin. Live runs need `STRAPI_API_TOKEN` and `STRAPI_BRIDGE_SECRET` from `apps/strapi/.env`: without the secret Strapi ignores `?status=draft` and publishes.
6. After the libraries are published and the index is reseeded, propose a drive for what the dataset lacks. Open `/community/propose?source=<dataset-key>&<level>=<place-slug>&gaps=<gap>`: the builder starts with that scope and gap and shows the live count. Keep each drive under 2,000 libraries to do, splitting by region where needed. Name the source's own site in "Where to look" only when its licence allows reuse.
