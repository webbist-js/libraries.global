# Dutch library institutions on Wikidata

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `nl-wikidata-libraries`
- Publisher: Wikidata contributors
- Catalogue: [Dutch library institutions on Wikidata](https://www.wikidata.org/wiki/Wikidata:WikiProject_Netherlands_Public_Libraries)
- Licence: [CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing)
- Attribution: Wikidata contributors. Dutch library institutions on Wikidata. https://www.wikidata.org/wiki/Wikidata:WikiProject_Netherlands_Public_Libraries. CC0 1.0. Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: NL; partial Wikidata physical library baseline, excluding known dissolved, digital, network and mobile entities.

## Mapping

Use query.rq with the Wikidata Query Service and save SPARQL JSON. Enforce country Q55. Group all bindings by library QID to remove SPARQL cross products. Map readable libraryLabel → name; unique address/website → corresponding fields. Multiple values are withheld with warnings. placeLabel is a review hint. QID is the stable source identity.

## Before execution

The query excludes known dissolved, digital, network and mobile entities. Review actual branch existence and duplicates against current institutional sources; Wikidata’s absence of a closure statement does not prove operation. Coordinates are deliberately neither queried nor imported.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=nl-wikidata-libraries --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
