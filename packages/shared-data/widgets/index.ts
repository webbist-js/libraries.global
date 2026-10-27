import { SUPPORTED_LOCALES } from "../locales"

/** Engineering bounds, not commercial plan allowances. */
export const WIDGET_LIMITS = {
  records: 2000,
  widgets: 100,
  selections: 100,
  sources: 10,
  groups: 12,
  origins: 20,
} as const
export const WIDGET_TYPES = ["finder", "directory", "chart", "stat"] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]
export const WIDGET_ACCENTS = {
  indigo: "#4338CA",
  green: "#2F6B45",
  rust: "#A8471F",
  slate: "#35507A",
  ink: "#17162B",
} as const
export type WidgetFilter = {
  country?: string
  region?: string
  libraryType?: string
  facility?: number
}
export type WidgetSource =
  | { kind: "owning_team" }
  | { kind: "network"; documentId: string }
  | { kind: "catalogue_filter"; filter: WidgetFilter }
export type WidgetSelectionSpec = {
  schemaVersion: 1
  membership: "follow_sources" | "fixed"
  sources: WidgetSource[]
  includeLibraryIds: string[]
  excludeLibraryIds: string[]
  filters: WidgetFilter
  groups: { id: string; name: string; libraryIds: string[] }[]
}
export type WidgetConfig = {
  title: string
  introduction: string
  description: string
  locale: string
  accent: keyof typeof WIDGET_ACCENTS
  border: "none" | "subtle" | "strong"
  radius: "square" | "soft" | "round"
  density: "comfortable" | "compact"
  search: boolean
  facilityFilter: boolean
  locate: boolean
  clusters: boolean
  labels: boolean
  reset: boolean
  showHours: boolean
  showAccess: boolean
  showLinks: boolean
  showPublisher: boolean
  hidePowered: boolean
  directoryLayout: "cards" | "list"
  pageSize: number
  mapMode: "both" | "map" | "list"
  metric: "libraries" | "facility"
  facility: number
  chartMode: "count" | "percentage"
  orientation: "horizontal" | "vertical"
  showTable: boolean
  valueLabels: boolean
  height: number
}
export const defaultWidgetConfig = (): WidgetConfig => ({
  title: "Find your library",
  introduction: "",
  description: "Explore the libraries in this selection.",
  locale: "en",
  accent: "indigo",
  border: "subtle",
  radius: "soft",
  density: "comfortable",
  search: true,
  facilityFilter: true,
  locate: false,
  clusters: true,
  labels: false,
  reset: true,
  showHours: true,
  showAccess: true,
  showLinks: true,
  showPublisher: true,
  hidePowered: false,
  directoryLayout: "cards",
  pageSize: 6,
  mapMode: "both",
  metric: "libraries",
  facility: 0,
  chartMode: "count",
  orientation: "horizontal",
  showTable: false,
  valueLabels: true,
  height: 640,
})
export const emptyWidgetSelection = (): WidgetSelectionSpec => ({
  schemaVersion: 1,
  membership: "follow_sources",
  sources: [{ kind: "owning_team" }],
  includeLibraryIds: [],
  excludeLibraryIds: [],
  filters: {},
  groups: [],
})
export function widgetObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RangeError("Expected an object")

  return value as Record<string, unknown>
}
export function widgetText(
  value: unknown,
  max: number,
  required = false
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim()) ||
    // eslint-disable-next-line no-control-regex -- reject non-printing C0 controls while allowing ordinary multiline text.
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
  )
    throw new RangeError("Invalid text")

  return value.trim()
}
export function widgetId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]{20,32}$/.test(value))
    throw new RangeError("Invalid identity")

  return value
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new RangeError("Invalid option")

  return value as T
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > WIDGET_LIMITS.records)
    throw new RangeError("Too many libraries")

  return [...new Set(value.map(widgetId))]
}
function parseFilter(value: unknown): WidgetFilter {
  const v = widgetObject(value),
    out: WidgetFilter = {}
  if (
    Object.keys(v).some(
      (k) => !["country", "region", "libraryType", "facility"].includes(k)
    )
  )
    throw new RangeError("Invalid filter")
  if (v.country) out.country = widgetId(v.country)
  if (v.region) out.region = widgetId(v.region)
  if (out.region && !out.country) throw new RangeError("Choose a country first")
  if (v.libraryType) out.libraryType = widgetText(v.libraryType, 80, true)
  if (v.facility !== undefined) {
    if (
      !Number.isInteger(v.facility) ||
      Number(v.facility) < 0 ||
      Number(v.facility) > 7
    )
      throw new RangeError("Invalid facility")
    out.facility = Number(v.facility)
  }

  return out
}

export function parseWidgetSelection(value: unknown): WidgetSelectionSpec {
  const v = widgetObject(value)
  if (
    v.schemaVersion !== 1 ||
    !Array.isArray(v.sources) ||
    v.sources.length > WIDGET_LIMITS.sources ||
    !Array.isArray(v.groups) ||
    v.groups.length > WIDGET_LIMITS.groups
  )
    throw new RangeError("Invalid selection")
  const sources: WidgetSource[] = v.sources.map((raw) => {
    const s = widgetObject(raw)
    if (s.kind === "owning_team") return { kind: "owning_team" }
    if (s.kind === "network")
      return { kind: "network", documentId: widgetId(s.documentId) }
    if (s.kind === "catalogue_filter") {
      const filter = parseFilter(s.filter)
      if (!Object.keys(filter).length)
        throw new RangeError("Narrow the catalogue filter")

      return { kind: "catalogue_filter", filter }
    }
    throw new RangeError("Invalid source")
  })
  const groups = v.groups.map((raw) => {
    const g = widgetObject(raw)

    return {
      id: widgetText(g.id, 40, true),
      name: widgetText(g.name, 100, true),
      libraryIds: ids(g.libraryIds),
    }
  })
  if (
    groups.reduce((sum, g) => sum + g.libraryIds.length, 0) >
    WIDGET_LIMITS.records
  )
    throw new RangeError(
      "Comparison groups may contain at most 2,000 library assignments in total"
    )
  if (new Set(groups.map((g) => g.id)).size !== groups.length)
    throw new RangeError("Duplicate group")

  return {
    schemaVersion: 1,
    membership: oneOf(v.membership, ["follow_sources", "fixed"]),
    sources,
    includeLibraryIds: ids(v.includeLibraryIds),
    excludeLibraryIds: ids(v.excludeLibraryIds),
    filters: parseFilter(v.filters),
    groups,
  }
}
export function parseWidgetConfig(value: unknown): WidgetConfig {
  const v = widgetObject(value),
    d = defaultWidgetConfig()
  const out = {
    ...d,
    title: widgetText(v.title, 160, true),
    introduction: widgetText(v.introduction, 1000),
    description: widgetText(v.description, 1500, true),
    locale: oneOf(v.locale, SUPPORTED_LOCALES),
    accent: oneOf(
      v.accent,
      Object.keys(WIDGET_ACCENTS) as (keyof typeof WIDGET_ACCENTS)[]
    ),
    border: oneOf(v.border, ["none", "subtle", "strong"]),
    radius: oneOf(v.radius, ["square", "soft", "round"]),
    density: oneOf(v.density, ["comfortable", "compact"]),
    directoryLayout: oneOf(v.directoryLayout, ["cards", "list"]),
    mapMode: oneOf(v.mapMode, ["both", "map", "list"]),
    metric: oneOf(v.metric, ["libraries", "facility"]),
    chartMode: oneOf(v.chartMode, ["count", "percentage"]),
    orientation: oneOf(v.orientation, ["horizontal", "vertical"]),
  }
  for (const key of [
    "search",
    "facilityFilter",
    "locate",
    "clusters",
    "labels",
    "reset",
    "showHours",
    "showAccess",
    "showLinks",
    "showPublisher",
    "hidePowered",
    "showTable",
    "valueLabels",
  ] as const) {
    if (typeof v[key] !== "boolean") throw new RangeError("Invalid switch")
    out[key] = v[key]
  }
  for (const [key, min, max] of [
    ["pageSize", 1, 50],
    ["facility", 0, 7],
    ["height", 240, 1600],
  ] as const) {
    if (
      !Number.isInteger(v[key]) ||
      Number(v[key]) < min ||
      Number(v[key]) > max
    )
      throw new RangeError("Invalid size")
    out[key] = Number(v[key])
  }

  return out
}
/** Exact HTTPS origins. HTTP localhost is supported only for local development. */
export function parseWidgetOrigins(
  value: unknown,
  allowLocal = false
): string[] {
  if (!Array.isArray(value) || value.length > WIDGET_LIMITS.origins)
    throw new RangeError("Too many websites")

  return [
    ...new Set(
      value.map((raw) => {
        const text = widgetText(raw, 300, true)
        let u: URL
        try {
          u = new URL(text.includes("://") ? text : `https://${text}`)
        } catch {
          throw new RangeError("Enter a website origin")
        }
        const local =
          allowLocal && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
        if (
          (u.protocol !== "https:" && !(local && u.protocol === "http:")) ||
          u.username ||
          u.password ||
          u.pathname !== "/" ||
          u.search ||
          u.hash ||
          /[\s*;,]/.test(text) ||
          (!local && !u.hostname.includes("."))
        )
          throw new RangeError("Use an exact HTTPS origin without a path")

        return u.origin
      })
    ),
  ]
}
export type WidgetLibrary = {
  documentId: string
  name: string
  href: string | null
  city: string | null
  address: string
  libraryType: string
  country: string | null
  location: { lat: number; lng: number } | null
  hours: string[]
  operationalStatus: string
  facilities: ("yes" | "no" | "unknown")[]
  why: string[]
  locale: string
  updatedAt: string | null
}
export type WidgetDiagnostics = {
  selected: number
  mapped: number
  missingCoordinates: number
  unresolvedIds: string[]
  excludedIds: string[]
  missingHours: number
  licenceIssues: string[]
}
export type WidgetResolved = {
  sourceLabels?: Record<string, string>
  rows: WidgetLibrary[]
  diagnostics: WidgetDiagnostics
  attribution: {
    label: string
    url: string | null
    licence: string | null
    licenceUrl: string | null
  }[]
  checkedAt: string
}
export type WidgetSelection = {
  documentId: string
  name: string
  version: number
  spec: WidgetSelectionSpec
  updatedAt: string
  usedBy?: { documentId: string; name: string; state: string }[]
}
export type WidgetRelease = {
  documentId: string
  version: number
  publishedAt: string
  type: WidgetType
  config: WidgetConfig
  spec: WidgetSelectionSpec
  selectionName: string
  selectionVersion: number
}
export type TeamWidget = {
  documentId: string
  publicId: string
  name: string
  type: WidgetType
  config: WidgetConfig
  selection: WidgetSelection | null
  draftVersion: number
  state: "draft" | "live" | "paused" | "unpublished" | "archived"
  reviewRequested: boolean
  hasChanges: boolean
  publishedVersion: number
  origins: string[]
  updatedAt: string
  release: WidgetRelease | null
  history: WidgetRelease[]
  loads: number
  blockedReports: number
}
export type WidgetWorkspace = {
  team: {
    documentId: string
    name: string
    active: boolean
    organiser: boolean
    branding: boolean
    libraryCount?: number
    primaryNetwork: { documentId: string; name: string; kind: string } | null
  }
  widgets: TeamWidget[]
  selections: WidgetSelection[]
}
export type PublicWidget = WidgetResolved & {
  publicId: string
  type: WidgetType
  config: WidgetConfig
  publisher: string
  version: number
  publishedAt: string
  spec: WidgetSelectionSpec
  origins: string[]
  branding: boolean
}
export function widgetMetric(
  rows: WidgetLibrary[],
  spec: WidgetSelectionSpec,
  config: WidgetConfig
) {
  const groups = spec.groups.length
    ? spec.groups
    : [
        {
          id: "all",
          name: "All selected libraries",
          libraryIds: rows.map((r) => r.documentId),
        },
      ]

  return groups.map((g) => {
    const ids = new Set(g.libraryIds),
      members = rows.filter((r) => ids.has(r.documentId)),
      total = members.length
    const yes =
      config.metric === "libraries"
        ? total
        : members.filter((r) => r.facilities[config.facility] === "yes").length
    const no =
      config.metric === "libraries"
        ? 0
        : members.filter((r) => r.facilities[config.facility] === "no").length

    return {
      id: g.id,
      name: g.name,
      total,
      yes,
      no,
      unknown: total - yes - no,
      recorded: yes + no,
      percentage: yes + no ? Math.round((yes / (yes + no)) * 100) : null,
    }
  })
}
