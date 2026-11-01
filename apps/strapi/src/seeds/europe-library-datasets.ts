import type { DatasetSeed } from "./datasets"
import { IRISH_FEEDS } from "./irish-library-feeds"

export const EUROPE_LIBRARY_DATASETS: DatasetSeed[] = [
  {
    key: "it-iccu",
    name: "Anagrafe delle Biblioteche Italiane",
    publisher: "ICCU — Istituto Centrale per il Catalogo Unico",
    sourceUrl: "https://anagrafe.iccu.sbn.it/it/open-data/",
    licence: "CC0 1.0",
    licenceUrl:
      "https://anagrafe.iccu.sbn.it/it/footer/norme-di-utilizzo-dei-dati/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted",
    attribution:
      "Library directory facts from ICCU, Anagrafe delle Biblioteche Italiane, CC0 1.0. Source ISIL and extraction vintage retained.",
    coverage:
      "Italian national directory. Closed, merged, planned, administrative and other unsupported registration states are excluded and reported. Uncensused institutions retain unknown operation.",
    importMechanism:
      "pnpm ingest --dataset=it-iccu; bounded ZIP/JSON snapshot, ISIL identities, existing geography, resumable draft writes.",
    notes:
      "The CC0 licence applies to open-data exports. Website editorial text and images have separate non-commercial terms and are not imported. Personal contacts, free-text hours and unspecified accessibility claims are omitted. A directory entry does not establish current operation or Atlas analytical support.",
  },
  ...IRISH_FEEDS.map(
    (feed): DatasetSeed => ({
      key: feed.key,
      name: `${feed.publisher} library directory`,
      publisher: feed.publisher,
      sourceUrl: `https://data.gov.ie/dataset/${feed.catalogue}`,
      licence: "CC BY 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      licenceStatus: "stated_by_publisher",
      redistribution: "permitted_with_attribution",
      attribution: `Contains library location data published by ${feed.publisher}, licensed under CC BY 4.0. Libraries Global normalises institutional fields and omits unsupported schedules.`,
      coverage: `${feed.publisher} source only; partial Irish coverage. Duplicate branch names and combined mobile/home-delivery records are quarantined.`,
      importMechanism: `pnpm ingest --dataset=${feed.key}; licence-checked catalogue snapshot, ArcGIS ID inventory and WGS84 point response, stable ${feed.idField} identities, resumable drafts.`,
      notes:
        "Never use ArcGIS row numbers as source identity. Review changed source counts before refreshing. Galway's feed includes city branches; do not additionally import the overlapping Galway City directory. Current operation, hours, individual accessibility facts and analytical country coverage are not inferred.",
    })
  ),
]
