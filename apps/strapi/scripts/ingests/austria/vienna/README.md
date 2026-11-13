# Vienna municipal library locations

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `at-vienna-libraries`
- Publisher: Stadt Wien
- Catalogue: [Vienna municipal library locations](https://www.data.gv.at/datasets/2adc5a86-faa3-4b63-acff-a66128b811b7)
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Attribution: Stadt Wien. Vienna municipal library locations. https://www.data.gv.at/datasets/2adc5a86-faa3-4b63-acff-a66128b811b7. CC BY 4.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: AT; Vienna municipal libraries only.

## Mapping

Read the WFS GeoJSON requested with EPSG:4326. NAME → name; ADRESSE → streetAddress; TELEFON → phone; WEBLINK1 → website; BEZIRK → district review hint. Fixed region hint Vienna and city Wien. Use name/address hash identity rather than treating the publisher’s GIS row number as permanent. Free-text OEFFNUNGSZEITEN fields are omitted.

## Before execution

Reported totalFeatures/numberMatched/numberReturned must equal the supplied feature count. Check the source coordinate licence and exact CMS spelling of Vienna; district numbers are not area IDs.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=at-vienna-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
