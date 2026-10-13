# Czech National Library directory

Run from `apps/strapi`, with `/usr/bin/python3` available:

```sh
pnpm ingest --dataset=nkp-cadr --check-cms
pnpm ingest --dataset=nkp-cadr --apply --limit=25
pnpm ingest --dataset=nkp-cadr --apply --concurrency=4
```

The National Library publishes [CADR](https://www.nkp.cz/en/about-us/professional-activities/open-data) under CC0. Its weekly MARC XML export is `https://aleph.nkp.cz/data/adr.xml.gz`. HTTP content encoding may decompress it before Node receives it, so the adapter checks gzip magic bytes. Python's standard XML parser validates the complete collection and preserves repeated institutional phone numbers. Personal contact and prose fields are excluded from the replay snapshot.

The inspected export has 8,156 unique SIGLA identifiers. Invalid identities, unsupported names, absent regions and STT entries marked closed or missing are skipped. Five district/region conflicts are quarantined: ABB503, ABC121, ABC039, ABC508 and ROE701. The validated CMS plan has 6,369 eligible institutions.

| MARC field    | Library field            | Rule                                                             |
| ------------- | ------------------------ | ---------------------------------------------------------------- |
| SGL.a         | `sourceRecords.recordId` | SIGLA, including distinct departments/services                   |
| NAZ.a–d       | `name`                   | Preserve hierarchical names                                      |
| KRJ.a / b     | Region / Area            | Existing kraj/okres; aliases for Prague, Vysočina and Brno-město |
| ADR.u / m / c | Address                  | First listed institutional address                               |
| ADR.g         | `location`               | Strict N/E DMS or decimal point; omitted for multiple addresses  |
| TYP.a         | Type                     | Published codes; mixed classifications become Other              |
| URL.u         | Website / catalogue      | Unqualified homepage and labelled online catalogue               |
| TEL.a         | `phone`                  | First institutional number                                       |

Prague's areas are city districts: an explicit first-address city of Praha 1–22 can match one. Unqualified Praha retains its region; a district under another region is quarantined.

All statuses remain unknown. Free-text schedules and staff contacts are omitted. Sources retain National Library credit, SIGLA, lookup URL and retrieval date. The shared pipeline creates drafts, checkpoints writes and skips existing identities on replay. It creates no places and changes no population data. Keep `.cache/` and `.runs/`; use `--snapshot=<saved .cache directory>` for offline replay.
