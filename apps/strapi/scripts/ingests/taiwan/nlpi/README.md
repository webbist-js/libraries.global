# Taiwan public library directory

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `tw-nlpi-libraries`
- Publisher: National Library of Public Information
- Catalogue: [Taiwan public library directory](https://data.gov.tw/dataset/99567)
- Licence: [Open Government Data License 1.0 (Taiwan)](https://data.gov.tw/en/license)
- Attribution: National Library of Public Information. Taiwan public library directory. https://data.gov.tw/dataset/99567. Open Government Data License 1.0 (Taiwan). Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: TW; public library directory grouped by county/city.

## Mapping

Flatten each 縣市 group’s 圖書館資訊 array. Name → name, Address → streetAddress, ZipCode → postalCode, TEL → phone, URL → website, Latitude/Longitude → candidate point. County/city and Area are geography hints. Identity is a deterministic hash of county/city, name and address; the feed has no durable branch ID. Intro and FAX are omitted.

## Before execution

Retain Chinese names. Reconcile relocations and renames before a refresh. The bounds include offshore islands; approve the administrative region explicitly.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=tw-nlpi-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
