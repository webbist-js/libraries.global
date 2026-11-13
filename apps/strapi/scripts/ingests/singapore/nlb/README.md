# Singapore NLB library locations

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `sg-nlb-libraries`
- Publisher: National Library Board
- Catalogue: [Singapore NLB library locations](https://data.gov.sg/datasets/d_27b8dae65d9ca1539e14d09578b17cbf/view)
- Licence: [Singapore Open Data Licence](https://data.gov.sg/open-data-licence)
- Attribution: National Library Board. Singapore NLB library locations. https://data.gov.sg/datasets/d_27b8dae65d9ca1539e14d09578b17cbf/view. Singapore Open Data Licence. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: SG; NLB locations, June 2024 edition; not all university or specialist libraries.

## Mapping

Read a complete GeoJSON FeatureCollection. Parse the NAME, ADDRESSBLOCKHOUSENUMBER, ADDRESSSTREETNAME, ADDRESSBUILDINGNAME, ADDRESSFLOORNUMBER, ADDRESSPOSTALCODE and HYPERLINK table cells from properties.Description. Geometry must be a WGS84 Point. The outer GeoJSON Name is not the human library name. Identity is a hash of library name and assembled address.

## Before execution

Download the final GeoJSON, not the poll-download envelope. Check current closures/relocations against the June 2024 edition. Select the existing whole-country Singapore Region. Review the type: NLB includes more than public branches.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=sg-nlb-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
