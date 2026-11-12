# Switzerland: Swiss ISIL Directory

```sh
pnpm ingest --dataset=ch-isil
pnpm ingest --dataset=ch-isil --local --check-cms
pnpm ingest --dataset=ch-isil --local --apply --limit=5
pnpm ingest --dataset=ch-isil --snapshot=scripts/ingests/switzerland/isil/.cache
```

Run from `apps/strapi`. The default maps the complete source without CMS access. CMS checks and writes require `--local` or `--production`. Existing `ch-isil` Source Records are skipped, so a rerun against the first import creates nothing new.

The Swiss National Library publishes the [Swiss ISIL Directory](https://opendata.swiss/en/dataset/schweizer-isil-verzeichnis) as a daily CSV at `https://www.isil.nb.admin.ch/opendata/latest.csv`. Its resource metadata declares [open use](https://opendata.swiss/terms-of-use#terms_open), which permits commercial and non-commercial reuse and recommends attribution. Dataset `ch-isil` keeps that credit.

The snapshot keeps the mapped columns only, plus the SHA-256 of the downloaded CSV. Contacts, holdings, histories and access notes are never stored. The first import (7 November 2026) read 2,491 rows: 1,137 new Libraries, three curated matches, 615 inactive, 729 not classified as libraries and seven foreign records.

| Source                                 | Library field                 | Rule                                                                                                                                                                                   |
| -------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ISIL`                                 | Source Record ID, slug suffix | Must match `CH-nnnnnn-c`. Slug is the ASCII-folded original name (160 characters at most) plus the lower-case ISIL, as published.                                                      |
| `Land`, `Status`, `Institutionstyp`    | eligibility                   | Only `CH`, `aktiv` and a type list containing `Bibliothek`. Archives and museums without a library type are excluded.                                                                  |
| `Name-Original`                        | `name`                        | Kept as published; no translation chosen.                                                                                                                                              |
| `Institutionskategorie`                | `libraryType`                 | First match wins: Nationalbibliothek → National; Hochschul- und Forschungsbibliothek → Academic; Öffentliche/Kantonsbibliothek → Public; Spezialbibliothek → Special; otherwise Other. |
| `Kanton`                               | Region                        | German names Freiburg, Genf, Luzern, Neuenburg, Tessin, Wallis and Waadt map to the existing Atlas names. No district is inferred from a town.                                         |
| `Strasse`, `Ortschaft`, `Postleitzahl` | address fields                | Kept as published when present.                                                                                                                                                        |
| `Webseite`                             | `website`                     | Only explicit `http(s)://` addresses of 255 characters or fewer, unchanged.                                                                                                            |
| —                                      | `operationalStatus`           | `unknown`. Registration does not establish current opening.                                                                                                                            |

The registry supplies no coordinates. Pins on Swiss Libraries came from a separate, reviewed address enrichment with its own swisstopo Dataset and per-record references. This adapter does not reproduce it, and existing pins are untouched because existing Source Records are skipped.

`CH-000008-6`, `CH-000003-X` and `CH-000011-1` were reconciled with the curated Zentralbibliothek Zürich, ETH-Bibliothek and Bibliothek Münstergasse. With a CMS check, each is linked by its curated slug when the street address still matches, then reported as existing. If the curated Library is absent or its address differs, the record is skipped for editorial review rather than duplicated.
