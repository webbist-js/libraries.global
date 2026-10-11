# Australian library imports

Run from `apps/strapi`; dry run is the default:

```sh
pnpm ingest --dataset=au-public-libraries --check-cms
pnpm ingest --dataset=au-public-libraries --apply --limit=25
pnpm ingest --dataset=au-public-libraries --apply --concurrency=4
pnpm ingest --dataset=slq-directory --check-cms
pnpm ingest --dataset=slq-directory --apply --concurrency=4
```

The historical source is Carl Higgs / RMIT's [Australian public lending library locations (2016–2018)](https://doi.org/10.25439/rmt.21944840.v1), version 1, CC BY-SA 4.0. Its CSV has 1,443 unique IDs. The adapter maps 926 rows from ACT, NSW, Tasmania, Victoria and Western Australia whose upstream licence explicitly states CC BY. The 31 Northern Territory and 158 South Australian rows have unclear republication terms and are skipped. The 328 old Queensland rows are superseded by the separate current source.

[State Library of Queensland's 2026 directory](https://www.data.qld.gov.au/dataset/public-libraries) states CC BY 4.0. Its CSV download returned no bytes during inspection, so the adapter reads the same resource through complete CKAN datastore pagination. The snapshot contains 336 branches. Identity comes from the directory URL path, not its mutable row number. Repeated publisher prefixes in those URLs are normalized narrowly.

| Source field                  | Library field            | Rule                                                |
| ----------------------------- | ------------------------ | --------------------------------------------------- |
| ID / directory path           | `sourceRecords.recordId` | Stable Dataset identity                             |
| Library / Branch Name         | `name`                   | Preserve source text                                |
| State                         | Region                   | Existing state or territory under Australia/Oceania |
| Address / locality / postcode | Address fields           | Physical address only                               |
| Latitude / longitude          | `location`               | Valid Australian point; mobile base pins omitted    |
| Queensland Phone              | `phone`                  | Published institutional number                      |

All statuses remain unknown. Historical locations do not establish current operation. Queensland mobile services use Australia/Brisbane as their timezone without presenting a depot as a visitor stop. Free-text schedules, personal contacts and inferred local government areas are omitted. Every library retains one origin source record, URL and retrieval date, with Dataset publisher credit.

The adapters use `_shared/directory.ts` and the shared resumable draft writer. They create no places and change no population data. CMS preflight checks every placement and slug. Replays skip existing source identities and preserve edits. Cache directories are `historical/.cache` and `queensland/.cache`; use `--snapshot=<directory>` for offline replay. Keep `.runs/` reports and snapshots.
