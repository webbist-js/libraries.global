import { arena } from "./connectors/arena"
import { aspen } from "./connectors/aspen"
import { durham } from "./connectors/durham"
import { enterprise } from "./connectors/enterprise"
import { iguana } from "./connectors/iguana"
import { koha } from "./connectors/koha"
import { luci } from "./connectors/luci"
import { prism } from "./connectors/prism"
import { spydus } from "./connectors/spydus"
import { webpac } from "./connectors/webpac"
import type { CatalogueConnector, CatalogueSystem } from "./types"

const connectors: Record<CatalogueSystem, CatalogueConnector> = {
  arena,
  aspen,
  durham,
  enterprise,
  iguana,
  koha,
  luci,
  prism,
  spydus,
  webpac,
}

export function getConnector(system: CatalogueSystem): CatalogueConnector {
  return connectors[system]
}
