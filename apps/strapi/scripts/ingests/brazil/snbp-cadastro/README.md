# SNBP library register 2025–2026

Prepared implementation only; no import has been run. See the [shared workflow](../../EXPANSION.md) for file acquisition, review, target selection and draft-only execution.

- Dataset: `br-snbp-cadastro`
- Publisher: Ministério da Cultura / Sistema Nacional de Bibliotecas Públicas
- Catalogue: [SNBP library register 2025–2026](https://dados.cultura.gov.br/dataset/sistema-nacional-de-bibliotecas-publicas-snbp)
- Licence: [Creative Commons Attribution (version unspecified)](https://dados.cultura.gov.br/dataset/sistema-nacional-de-bibliotecas-publicas-snbp)
- Attribution: Ministério da Cultura / Sistema Nacional de Bibliotecas Públicas. SNBP library register 2025–2026. https://dados.cultura.gov.br/dataset/sistema-nacional-de-bibliotecas-publicas-snbp. Creative Commons Attribution (version unspecified). Libraries Global normalises directory fields; retrieval date and original record identity are retained.
- Coverage: BR; public and community library register, incomplete national coverage; no coordinates.

## Mapping

Read the original Cadastro_de_Bibliotecas-SNBP_2025-2026.xlsx. Detect exactly one worksheet containing the required headers. NOME DA BIBLIOTECA → name; ENDEREÇO → streetAddress; NOME MUNICIPIO → city/area hint; UF → region hint; CEP → formatted eight-digit postal code. Accept PÚBLICA and COMUNITÁRIA categories. Both initially map to Public. Identity is 2025-2026 plus a name/address/UF/municipality hash. No coordinates, operator identity or timezone are inferred.

## Before execution

UF contains full state names, not two-letter abbreviations. Reconcile the existing curated Brazilian library. Long addresses are omitted with a warning, not truncated. The catalogue states CC Attribution without a version: retain the exact statement and confirm it has not changed. A different register edition requires a deliberate adapter/reconciliation change.

Use this dataset argument for a separate preparation/review/apply sequence:

```sh
pnpm ingest --dataset=br-snbp-cadastro --file=<saved-publisher-export> --retrieved-at=<actual-UTC-ISO-timestamp>
```

The default produces candidate/review files only. The exact download request is in [`_shared/expansion-feeds.ts`](../../_shared/expansion-feeds.ts). Supply a completed `--review` for the later offline validation and CMS checks. The adapter reuses the shared directory writer only after review. Every row needs an import or skip decision; uncertain geography, existing curated records and unsupported services must be resolved before applying.
