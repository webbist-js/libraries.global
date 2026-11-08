# Kenya ALVA library locations, April 2022

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `ke-alva`
- Publisher: AfLIA / TASCHA, University of Washington
- Catalogue: [Kenya ALVA library locations, April 2022](https://osf.io/entpf/)
- Licence: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Attribution: AfLIA / TASCHA, University of Washington. Kenya ALVA library locations, April 2022. https://osf.io/entpf/. CC0 1.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: KE subset of library20220428.csv; historical and incomplete; no coordinates imported.

## Mapping

Read the full library20220428.csv from OSF, then select Country / … = Kenya. OBJECTID → source identity; Name of Library / … → name; Street Address / … → address unless it is a PO box; Name of community or town / … → city. Match multilingual headers by their unique English prefix. Personal contact names/emails and all coordinates are omitted.

## Before execution

The historical source had 812 total rows and 68 Kenyan rows; verify the frozen file, not a different latest release. Review current names and county operators after devolution. The legal-notice supplement is not part of this adapter. No present-day operator or opening status is inferred.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=ke-alva --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
