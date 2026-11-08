# New Zealand library institutions on Wikidata

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `nz-wikidata-libraries`
- Publisher: Wikidata contributors
- Catalogue: [New Zealand library institutions on Wikidata](https://www.wikidata.org/wiki/Wikidata:WikiProject_Libraries)
- Licence: [CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing)
- Attribution: Wikidata contributors. New Zealand library institutions on Wikidata. https://www.wikidata.org/wiki/Wikidata:WikiProject_Libraries. CC0 1.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: NZ; partial Wikidata physical library baseline, excluding known dissolved, digital, network and mobile entities.

## Mapping

Use query.rq with the Wikidata Query Service and save SPARQL JSON. Enforce country Q664. Group all bindings by library QID. Map readable libraryLabel → name; unique address/website → corresponding fields. Ambiguous fields are withheld. placeLabel is a review hint; QID is the stable source identity.

## Before execution

Coverage is incomplete. No Wikidata points or National Library directory content are imported. LINZ address matching needs its own source snapshot, attribution and precision review in a later enrichment. The Chatham Islands must not inherit a mainland timezone by assumption.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=nz-wikidata-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
