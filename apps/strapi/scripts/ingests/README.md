# Dataset ingests

Each ingest imports one registered Dataset (see `CONTEXT.md`). Ingests are grouped by country:

```
ingests/
  _shared/     CLI flags, CSV reader, file fetch and checksum, run log, text helpers
  usa/         states.ts (every US ingest), plus one folder per dataset
    imls-pls/
```

The LibraryOn ingest is still at `scripts/libraryon-ingest.ts` and has yet to move to `uk/libraryon/`.

## Adding one

1. Check the licence allows republication under CC BY-SA 4.0 (see CONTRIBUTING.md, Provenance), then add the dataset to `src/seeds/datasets.ts`.
2. Make a folder `<country>/<dataset-key>/` with:
   - `map.ts`: pure functions from a source row to library fields and geography. It does no I/O, so it can be unit tested.
   - `ingest.ts`: reads the source, maps every row, then writes drafts through `scripts/strapi-client.ts`. It must support `--dry-run`, which needs no token.
   - `README.md`: the licence, the file and its URL, and a column → field table with the reason for every rule.
3. Give every library `source: "<dataset-key>"` and a `sourceRecords` entry holding the source's own ID. `StrapiClient.librariesBySourceRecord()` loads the existing matches, so a re-run skips what's already there.
4. Put tests for `map.ts` in `tests/ingests/`.
5. Dry-run first and read the run log (`*.ingest-log.json`, git-ignored). Then do a small live run with `--limit` and check the drafts in the admin. Live runs need `STRAPI_API_TOKEN` and `STRAPI_BRIDGE_SECRET` from `apps/strapi/.env`: without the secret Strapi ignores `?status=draft` and publishes.
6. After the libraries are published and the index is reseeded, propose a drive for what the dataset lacks. Open `/community/propose?source=<dataset-key>&<level>=<place-slug>&gaps=<gap>`: the builder starts with that scope and gap and shows the live count. Keep each drive under 2,000 libraries to do, splitting by region where needed. Name the source's own site in "Where to look" only when its licence allows reuse.
