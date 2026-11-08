# French-community public library directory

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `be-fwb-libraries`
- Publisher: Ministère de la Communauté française
- Catalogue: [French-community public library directory](https://www.odwb.be/explore/dataset/les-bibliotheques-publiques-en-federation-wallonie-bruxelles/)
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Attribution: Ministère de la Communauté française. French-community public library directory. https://www.odwb.be/explore/dataset/les-bibliotheques-publiques-en-federation-wallonie-bruxelles/. CC BY 4.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: BE; French-community network, not complete Belgian coverage; reviewed physical branches only.

## Mapping

Read the complete exports/json array. denomination → name; adresse → streetAddress; cp → postalCode; ville → city/area hint; province → region hint; telephone → phone; web → website; geolocalisation.lat/lon → candidate point. Identity is a hash of denomination, address, postcode and town. BCE identifiers are not used as branch identities.

## Before execution

Compare export count with the portal total_count. Province names are source hints and may not match the Atlas Region level. Review categorie to separate visitor branches from support operators, special libraries and bibliobuses. Coverage excludes the Flemish network.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=be-fwb-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
