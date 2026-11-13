# Graz library locations

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `at-graz-libraries`
- Publisher: Stadt Graz
- Catalogue: [Graz library locations](https://www.data.gv.at/datasets/4904b8e4-a002-4bcd-bda3-d496eab8fda4)
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Attribution: Stadt Graz. Graz library locations. https://www.data.gv.at/datasets/4904b8e4-a002-4bcd-bda3-d496eab8fda4. CC BY 4.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: AT; Graz library layer, including academic libraries; separate from Vienna.

## Mapping

Read ArcGIS layer 23 with outSR=4326 and all fields. NAME → name; STRASSENNAME + HAUSNR → streetAddress; PLZ → postalCode; ORT → city; geometry.x/y → candidate point. Region hint Styria; area hint Graz. Identity is a hash of name, address and postcode; OBJEKT_ID is an unstable ArcGIS OID.

## Before execution

Compare a separate returnCountOnly=true result with the saved feature count. Reject exceededTransferLimit. The inspected layer contains academic and other libraries, despite the catalogue’s municipal wording; classify each during review. Verify that the layer remains covered by the linked catalogue licence.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=at-graz-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
