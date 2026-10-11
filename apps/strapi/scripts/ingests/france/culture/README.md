# French public libraries

Run from `apps/strapi`:

```sh
pnpm ingest --dataset=fr-culture-libraries --check-cms
pnpm ingest --dataset=fr-culture-libraries --apply --limit=25
pnpm ingest --dataset=fr-culture-libraries --apply --concurrency=4
```

Source: [Ministère de la Culture, Les bibliothèques des collectivités territoriales](https://www.data.gouv.fr/datasets/adresses-des-bibliotheques-publiques-2), [Licence Ouverte 2.0](https://www.data.gouv.fr/pages/legal/licences/etalab-2.0). The adapter pins the complete JSON resource published on 27 August 2025: 15,704 unique `code_bib` identifiers, addresses at 5 June 2025 and activity data for 2023. Changed release counts require review.

| Source field                 | Library field            | Rule                                                             |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `code_bib`                   | `sourceRecords.recordId` | Preserve LI/BD identifiers                                       |
| `nom_de_l_etablissement`     | `name`                   | Preserve French labels                                           |
| `region`, `departement`      | Region / Area            | Existing metropolitan hierarchy; conflicting parents quarantined |
| `type_adresse`               | Type / eligibility       | Bâtiment ouvert → Public; Bibliobus → Mobile                     |
| `adresse`, `ville`, `cp`     | Address                  | Preserve strings and leading zeros                               |
| `latitude`, `longitude`      | `location`               | Valid metropolitan point; mobile base pins omitted               |
| `telephone`, `site_internet` | Contact fields           | Published number; valid HTTP(S) URL                              |

Only visitor buildings and bookmobiles are imported. Bookmobiles use Europe/Paris as their timezone without presenting base coordinates as visitor stops. Administrative sites, document reserves, departmental distribution sites and unspecified address types are excluded. Overseas rows belong to separate atlas countries. Opening totals, activity figures and commune populations are not converted into daily schedules or library statistics.

Haute-Garonne and Corsican departments match existing English names. Loir-et-Cher matches the existing misspelling Loire-et-Cher without changing place text or URLs. LI20238 places Pyrénées-Atlantiques under Occitanie and is quarantined. The validated CMS plan has 15,061 eligible records.

Statuses remain unknown. Dataset credit keeps the publisher and source date; libraries retain an origin ID and URL. No geography or population migrations are needed. Snapshots, row accounting, slug checks, locks and checkpoints use the shared directory pipeline. Use `--snapshot=<saved .cache directory>` to replay; source matches are skipped rather than refreshed over edits.
