import type {
  WidgetConfig,
  WidgetSelectionSpec,
  WidgetType,
} from "@repo/shared-data"

import type {
  Identity,
  DocumentRuntime,
} from "../../../../utils/document-store"

export type { Identity } from "../../../../utils/document-store"
/** Internal projections populated by dedicated queries, never generic API DTOs. */
export type NamedRecord = Identity & {
  name: string
  slug?: string
  kind?: string
  city?: string
}
export type LibraryRecord = NamedRecord & {
  updatedAt?: string
  locale?: string
  entityRef?: string
  streetAddress?: string
  postalCode?: string
  location?: { lat: number; lng: number } | null
  openingTimes?: unknown
  absentFacilities?: string[]
  operationalStatus?: string
  libraryType?: { name: string }
  continent?: { slug: string }
  country?: { name: string; slug: string }
  region?: { slug: string }
  accessibility?: { name: string }[]
  amenities?: { name: string }[]
  services?: { name: string }[]
  sourceRecords?: { role?: string; dataset: string }[]
}
export type TeamRecord = NamedRecord & {
  status?: string | null
  source?: string | null
  expiresAt?: string | null
  billingMode?: string | null
  billingArchived?: boolean
  widgetBranding?: boolean
  libraries?: Identity[]
  primaryNetwork?: NamedRecord | null
}
export type TeamContext = TeamRecord & {
  active: boolean
  organiser: boolean
  branding: boolean
}
export type SelectionRecord = Identity & {
  name: string
  version: number
  spec: WidgetSelectionSpec
  updatedAt: string
  team: Identity
}
export type ReleaseSnapshot = {
  type: WidgetType
  config: WidgetConfig
  spec: WidgetSelectionSpec
  selectionName: string
  selectionVersion: number
}
export type ReleaseRecord = Identity & {
  version: number
  publishedAt: string
  snapshot: ReleaseSnapshot
  widget: Identity
}
export type WidgetRecord = Identity & {
  id: number
  name: string
  publicId: string
  type: WidgetType
  config: WidgetConfig
  team: TeamRecord
  selection: SelectionRecord
  draftVersion: number
  state: "draft" | "live" | "paused" | "unpublished" | "archived"
  reviewRequested: boolean
  hasChanges: boolean
  publishedVersion: number
  origins: string[]
  updatedAt: string
  publishedRelease: ReleaseRecord | null
  loads: number | string
  blockedReports: number | string
}
export type DatasetRecord = NamedRecord & {
  key: string
  publisher?: string
  redistribution?: string
  attribution?: string
  licence?: string
  licenceUrl?: string
  sourceUrl?: string
}
export type WidgetRecordMap = {
  "plugin::access.widget": WidgetRecord
  "plugin::access.widget-selection": SelectionRecord
  "plugin::access.widget-release": ReleaseRecord
  "plugin::access.widget-audit": Identity
  "plugin::access.team": TeamRecord
  "plugin::access.team-member": Identity & { teamRole: string }
  "api::library.library": LibraryRecord
  "api::library-network.library-network": NamedRecord
  "api::country.country": NamedRecord
  "api::region.region": NamedRecord
  "api::dataset.dataset": DatasetRecord
  "api::library-affiliation.library-affiliation": Identity & {
    library?: Identity
    authorityManaged?: boolean
  }
}
export type WidgetUid = keyof WidgetRecordMap
export type { DocumentStore } from "../../../../utils/document-store"
export type WidgetInput = Record<string, unknown>

export type WidgetStrapi = DocumentRuntime & {
  db: {
    metadata: {
      get: (uid: string) => {
        tableName: string
        attributes: Record<string, { columnName: string }>
      }
    }
    connection: (table: string) => {
      where: (filter: { id: number }) => {
        increment: (column: string, amount: number) => Promise<unknown>
      }
    }
  }
}
