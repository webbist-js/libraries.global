# Latvian library institutions

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `lv-kisc-libraries`
- Publisher: Kultūras informācijas sistēmu centrs
- Catalogue: [Latvian library institutions](https://data.gov.lv/dati/dataset/latvijas-kulturas-institucijas)
- Licence: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Attribution: Kultūras informācijas sistēmu centrs. Latvian library institutions. https://data.gov.lv/dati/dataset/latvijas-kulturas-institucijas. CC0 1.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: LV; library subset of cultural institution register, including school and academic libraries.

## Mapping

Filter Nozare = Bibliotēkas. Map Objekta nosaukums → name, Adrese → streetAddress, Tālrunis → phone, Objekta URL → website, LAT/LON → candidate point. ISIL kods is the source identity when present; otherwise derive a hash of name/address. Adreses ATVK kods remains a review hint, not a CMS ID. Preserve the distinction between public, national, academic and special libraries; school libraries map to Other. Non-library cultural rows are excluded before candidate review.

## Before execution

Verify current administrative placement from ATVK and institutional addresses. Do not derive a municipality from postal text alone. Source URL is a directory profile and may not be the library’s own website.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=lv-kisc-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
