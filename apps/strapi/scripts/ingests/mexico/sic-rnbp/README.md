# Mexico: SIC public-library directory

```sh
pnpm ingest --dataset=mx-sic-rnbp
pnpm ingest --dataset=mx-sic-rnbp --check-cms
pnpm ingest --dataset=mx-sic-rnbp --apply --limit=5
pnpm ingest --dataset=mx-sic-rnbp --apply --concurrency=4
pnpm ingest --dataset=mx-sic-rnbp --snapshot=scripts/ingests/mexico/sic-rnbp/.cache
```

Run from `apps/strapi`. The default maps the complete source without CMS writes. `--check-cms` also checks existing geography, identities and slug collisions. `--apply` creates drafts. Existing source identities are skipped on reruns, preserving contributor edits. Use `--refresh` to obtain a new snapshot; it cannot be combined with `--snapshot`.

The [Sistema de Información Cultural directory](https://sic.cultura.gob.mx/datos.php?table=rnbp) publishes a [complete JSON download](https://sic.cultura.gob.mx/opendata/d/0_rnbp_directorio.json). The page lists 7 February 2025; individual modification dates differ. The observed file contains 7,476 records in all 32 states. Coverage means the National Network of Public Libraries, not every kind of Mexican library.

The publisher's [reuse terms](https://sic.cultura.gob.mx/datos.php) permit copying, publication, adaptation and commercial use with credit. Dataset `mx-sic-rnbp` stores that credit and licence link. The cached snapshot retains the request URL and retrieval date; each report records its SHA-256. Keep `.cache/` and `.runs/` with the import evidence.

| Source                            | Library field                      | Rule                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rnbp_id`                         | Source Record ID, slug suffix      | Stable SIC identity; collection numbers are not IDs.                                                                                                                                                                 |
| `rnbp_nombre`                     | `name`                             | Decode Spanish HTML entities and numeric references; preserve accents. Missing names are skipped.                                                                                                                    |
| `estado_id`, `nom_ent`            | Country, Region                    | Require agreement with the explicit 32-state table. Coahuila, Michoacán, Veracruz and Mexico City use existing Atlas names.                                                                                          |
| `nom_mun`                         | Area, `district`                   | Match under the selected state. Names shared by multiple official municipality codes retain state placement with a warning. Conflicting parents are quarantined by the shared runner; absent Areas produce warnings. |
| `nom_loc`                         | `city`                             | Omit `Total del Municipio` and missing values; a municipality is not an established visitor locality.                                                                                                                |
| `gmaps_latitud`, `gmaps_longitud` | `location`                         | Require both finite values inside Mexican bounds. Invalid points are omitted with a warning.                                                                                                                         |
| `rnbp_calle_numero`, `rnbp_cp`    | `streetAddress`, `postalCode`      | Keep valid field lengths and five-digit postal strings, including leading zeros.                                                                                                                                     |
| `rnbp_telefono1`, `pagina_web`    | `phone`, `website`                 | Directory telephone and valid HTTP(S) website only.                                                                                                                                                                  |
| `rnbp_adscripcion`                | `operatorType`                     | Municipality for explicit municipal government/alcaldía; Regional Government for explicit state/CDMX government. Other operators remain unspecified.                                                                 |
| Directory membership              | `libraryType`, `operationalStatus` | Public library; operational status unknown.                                                                                                                                                                          |

The adapter rejects duplicate/missing IDs, missing source columns, unexpected counts outside 7,000–9,000 and any download missing a state. A state-code/name conflict skips the record with an explicit reason. No places, population, hours, email addresses or founding dates are created. Library publication and search reseeding remain separate steps.

Validation on 24 October 2026 mapped all 7,476 source rows. Local CMS preflight accepted 7,473 and quarantined three municipality/region matches for review; 76 accepted records had no matched Area. The two repeated Oaxaca municipality names retain state placement. Twelve eligible records have no usable coordinates. A five-draft smoke import passed source, country/region and publication-state read-back checks.
