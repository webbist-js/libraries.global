/**
 * The "compare what each offer includes" matrix for /plans and the Atlas
 * plans sheet. Tool rows are read from the entitlement resolver, so the
 * table can't claim more than the access code grants; staff rows are
 * capabilities from verified staff claims, never entitlements. Planned rows
 * ("soon") never show a tick. Labels live in `membershipContent.rows`.
 */
import {
  type EntitlementInput,
  type Feature,
  resolveEntitlements,
} from "@repo/access"

import { FEATURE_STATUS } from "./plans"

/** Who the column describes. Columns are independent, not cumulative. */
export type CompareColumn =
  | "public"
  | "explorer"
  | "contributor"
  | "staff"
  | "api"

export const COMPARE_COLUMNS: readonly CompareColumn[] = [
  "public",
  "explorer",
  "contributor",
  "staff",
  "api",
]

export type CompareCell = "yes" | "soon" | "no"

export type CompareRow = {
  id: string
  cells: Record<CompareColumn, CompareCell>
  /** A cell's value message (`membershipContent.cells.<id>`) instead of a tick. */
  cellValues?: Partial<Record<CompareColumn, string>>
  /** The Roadmap item tracking a row that isn't built yet. */
  roadmapKey?: string
}

export type CompareGroup = { id: string; rows: CompareRow[] }

/**
 * Roadmap item keys (CMS `roadmap.feature.key`) for features not built
 * yet. The plans page links a row only when the published Roadmap still
 * lists that item, so an editor removing one never leaves a dead link.
 */
export const ROADMAP_KEY_FOR_FEATURE: Partial<Record<Feature, string>> = {
  "index.export": "export-attribution",
  "index.alerts": "search-alerts",
  "index.compare": "compare-libraries",
  "library.watch": "watch-library",
  "library.notes": "private-notes",
  "data.benchmark": "benchmark-services",
  "events.personalFeed": "calendar-feed",
}

const FAR_FUTURE = "9999-12-31T00:00:00.000Z"

/** The resolver input each column stands for. Staff read as Explorer. */
const COLUMN_INPUT: Record<CompareColumn, EntitlementInput> = {
  public: { signedIn: false, now: new Date(0) },
  explorer: { signedIn: true, now: new Date(0) },
  contributor: { signedIn: true, now: new Date(0), acceptedContributions: 1 },
  staff: { signedIn: true, now: new Date(0) },
  api: {
    signedIn: true,
    now: new Date(0),
    apiAccounts: [{ role: "organiser", paidThrough: FAR_FUTURE }],
  },
}

const ENTITLEMENTS = Object.fromEntries(
  COMPARE_COLUMNS.map((c) => [c, resolveEntitlements(COLUMN_INPUT[c])])
) as Record<CompareColumn, ReturnType<typeof resolveEntitlements>>

/** Whether a column's resolved entitlements include a feature. */
export function columnHas(column: CompareColumn, feature: Feature): boolean {
  return ENTITLEMENTS[column].features.has(feature)
}

const cellsFor = (
  columns: readonly CompareColumn[],
  status: CompareCell = "yes"
): Record<CompareColumn, CompareCell> =>
  Object.fromEntries(
    COMPARE_COLUMNS.map((c) => [c, columns.includes(c) ? status : "no"])
  ) as Record<CompareColumn, CompareCell>

const SIGNED_IN: readonly CompareColumn[] = [
  "explorer",
  "contributor",
  "staff",
  "api",
]

function featureRow(
  feature: Feature,
  cellValues?: Partial<Record<CompareColumn, string>>
): CompareRow {
  const status: CompareCell =
    FEATURE_STATUS[feature] === "live" ? "yes" : "soon"
  const roadmapKey =
    status === "soon" ? ROADMAP_KEY_FOR_FEATURE[feature] : undefined

  return {
    id: feature,
    cells: cellsFor(
      COMPARE_COLUMNS.filter((c) => columnHas(c, feature)),
      status
    ),
    ...(cellValues
      ? {
          cellValues: Object.fromEntries(
            Object.entries(cellValues).filter(([c]) =>
              columnHas(c as CompareColumn, feature)
            )
          ),
        }
      : {}),
    ...(roadmapKey ? { roadmapKey } : {}),
  }
}

const plain = (
  id: string,
  columns: readonly CompareColumn[],
  status: CompareCell = "yes",
  cellValues?: Partial<Record<CompareColumn, string>>
): CompareRow => ({
  id,
  cells: cellsFor(columns, status),
  ...(cellValues ? { cellValues } : {}),
})

const each = (columns: readonly CompareColumn[], value: string) =>
  Object.fromEntries(columns.map((c) => [c, value])) as Partial<
    Record<CompareColumn, string>
  >

export function compareGroups(): CompareGroup[] {
  const groups: CompareGroup[] = [
    {
      id: "facts",
      rows: [
        plain("records", COMPARE_COLUMNS),
        plain("map", COMPARE_COLUMNS),
        plain("reading", COMPARE_COLUMNS),
        plain("downloads", COMPARE_COLUMNS),
        plain("apiReference", COMPARE_COLUMNS),
      ],
    },
    {
      id: "account",
      rows: [
        plain("contribute", SIGNED_IN),
        plain("follow", SIGNED_IN),
        plain("discussions", SIGNED_IN),
        plain("drives", SIGNED_IN),
        plain("savedViews", SIGNED_IN, "yes", each(SIGNED_IN, "savedViews")),
      ],
    },
    {
      id: "atlas",
      rows: [
        featureRow("atlas.contextLayers"),
        featureRow("atlas.analysis"),
        featureRow("atlas.compare"),
        featureRow("atlas.export", each(SIGNED_IN, "exportRows")),
        featureRow("atlas.reach", {
          contributor: "reachWeek",
          api: "reachHour",
        }),
        featureRow("atlas.serviceReach", { api: "serviceLibraries" }),
      ],
    },
    {
      id: "watching",
      rows: (
        [
          "library.history",
          "library.watch",
          "index.alerts",
          "index.compare",
          "library.notes",
          "events.personalFeed",
          "index.export",
          "data.benchmark",
          "data.explorerExport",
        ] as const
      ).map((f) => featureRow(f)),
    },
    {
      id: "staff",
      rows: [
        plain("staffWorkspace", ["staff"]),
        plain("staffEditing", ["staff"]),
        plain("staffOrganisation", ["staff"]),
        plain("staffWidgets", ["staff"]),
        plain("staffTraffic", ["staff"], "soon"),
      ],
    },
    {
      id: "api",
      rows: [
        featureRow("api.key"),
        plain("apiAllowance", ["api"], "yes", { api: "apiAllowance" }),
        plain("apiOverage", ["api"]),
        plain("apiPlayground", ["api"]),
      ],
    },
  ]

  return groups.filter((g) => g.rows.length > 0)
}

/** Every row id, for message coverage tests. */
export function compareRowIds(): string[] {
  return compareGroups().flatMap((g) => g.rows.map((r) => r.id))
}

/** Keeps rows that at least one column has today ("Only show what's available now"). */
export function availableNow(groups: CompareGroup[]): CompareGroup[] {
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) => Object.values(r.cells).includes("yes")),
    }))
    .filter((g) => g.rows.length > 0)
}

/** The rows the Atlas plans sheet shows, in order. */
export const ATLAS_SHEET_ROW_IDS = [
  "records",
  "map",
  "follow",
  "atlas.contextLayers",
  "atlas.analysis",
  "atlas.compare",
  "atlas.export",
  "atlas.reach",
  "atlas.serviceReach",
] as const

export function compareRowsById(ids: readonly string[]): CompareRow[] {
  const all = compareGroups().flatMap((g) => g.rows)

  return ids.flatMap((id) => all.filter((r) => r.id === id))
}

/** A row id as a message key (`atlas.reach` → `atlas_reach`). */
export const rowMessageKey = (id: string) => id.replaceAll(".", "_")
