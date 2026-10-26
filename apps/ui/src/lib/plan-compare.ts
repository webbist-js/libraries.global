/**
 * The "compare every plan" matrix for /contribute/membership and the Atlas
 * plans sheet. Rows
 * are derived from lib/plans.ts (each plan's includes) and the entitlement
 * resolver (which Pro features each plan gets), so the table can't claim
 * more than the plans do. Status comes from the copy: "soon" never shows ✓.
 */
import { type Feature, FEATURES } from "@repo/access"

import {
  ATLAS_PER_CAPITA_LABEL,
  featuresOf,
  exportLimitOf,
  type PlanCardKey,
  type PlanPrice,
  PLANS,
  PRO_FEATURE_COPY,
} from "./plans"

export type CompareCell = "yes" | "soon" | "no"

export type CompareRow = {
  id: string
  label: string
  cells: Record<PlanCardKey, CompareCell>
  cellLabelIsExport?: boolean
  cellLabels?: Partial<Record<PlanCardKey, string>>
}

export type CompareGroup = { id: string; title: string; rows: CompareRow[] }

export function compareGroupSummary(group: CompareGroup): string {
  const now = group.rows.filter((row) =>
    Object.values(row.cells).includes("yes")
  ).length
  const soon = group.rows.length - now

  return [
    now > 0 ? `${now} available now` : null,
    soon > 0 ? `${soon} on the roadmap` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Column order: each plan includes everything to its left. */
export const COMPARE_PLANS: readonly PlanCardKey[] = PLANS.map((p) => p.key)

const SOON_SUFFIX = " (coming soon)"

/** Includes that only point at another column, not features of their own. */
const IS_POINTER = /^(Everything in |Pro for every seat)/

/** Pro features get their own rows, so their include lines are skipped. */
const FEATURE_LABELS = new Set([
  ATLAS_PER_CAPITA_LABEL,
  "Larger service Reach: up to 100 libraries and a 40,000 km² envelope, one travel time per calculation",
  ...Object.values(PRO_FEATURE_COPY).map((c) => c.label),
])

const GROUP_FOR_PLAN: Partial<Record<PlanCardKey, string>> = {
  public: "facts",
  free: "contributing",
  supporter: "supporting",
  team: "teams",
}

const FEATURE_GROUPS: Record<string, readonly Feature[]> = {
  atlas: [
    "atlas.export",
    "atlas.contextLayers",
    "atlas.analysis",
    "atlas.compare",
    "data.benchmark",
    "data.explorerExport",
  ],
  watching: [
    "library.history",
    "library.watch",
    "index.alerts",
    "index.compare",
    "library.notes",
    "events.personalFeed",
    "index.export",
  ],
  teams: [
    "library.team",
    "library.traffic",
    "team.workspace",
    "team.bulkUpload",
    "team.embed",
    "api.key",
  ],
}

const GROUP_TITLES: [id: string, title: string][] = [
  ["facts", "Library facts"],
  ["contributing", "Contributing and following"],
  ["supporting", "Supporting the project"],
  ["atlas", "Atlas analysis"],
  ["watching", "Watching and comparing libraries"],
  ["teams", "For teams"],
  // Catches any feature added to @repo/access before it gets a group.
  ["more", "More Pro features"],
]

function slug(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

function cellsFrom(
  from: PlanCardKey,
  status: CompareCell
): Record<PlanCardKey, CompareCell> {
  const start = COMPARE_PLANS.indexOf(from)

  return Object.fromEntries(
    COMPARE_PLANS.map((key, i) => [key, i >= start ? status : "no"])
  ) as Record<PlanCardKey, CompareCell>
}

/** Rows for the plain includes of Public, Free account, Supporter and Team. */
function includeRows(): { group: string; row: CompareRow }[] {
  return PLANS.flatMap((plan) => {
    const group = GROUP_FOR_PLAN[plan.key]
    if (!group) return []

    return plan.includes
      .filter((item) => item.kind !== "note" && !IS_POINTER.test(item.text))
      .flatMap((item) => {
        const label = item.text.endsWith(SOON_SUFFIX)
          ? item.text.slice(0, -SOON_SUFFIX.length)
          : item.text
        if (
          [...FEATURE_LABELS].some(
            (feature) => label === feature || label.startsWith(`${feature} (`)
          )
        )
          return []

        return [
          {
            group,
            row: {
              id: slug(label),
              label,
              cells: cellsFrom(plan.key, item.kind === "soon" ? "soon" : "yes"),
            },
          },
        ]
      })
  })
}

function featureRow(feature: Feature): CompareRow {
  const copy = PRO_FEATURE_COPY[feature]
  const status: CompareCell = copy.status === "live" ? "yes" : "soon"
  const pro = featuresOf("pro").includes(feature)
  const supporter = featuresOf("supporter").includes(feature)
  const team = featuresOf("team").includes(feature)

  return {
    id: feature,
    label: copy.label,
    cells: {
      public: "no",
      free: "no",
      supporter: supporter ? status : "no",
      pro: pro ? status : "no",
      team: team ? status : "no",
    },
    ...(feature === "atlas.export"
      ? {
          cellLabelIsExport: true,
          cellLabels: Object.fromEntries(
            (["supporter", "pro", "team"] as const).map((plan) => [
              plan,
              `${exportLimitOf(plan).toLocaleString("en-GB")}`,
            ])
          ),
        }
      : {}),
  }
}

export function compareGroups(): CompareGroup[] {
  const byGroup = new Map<string, CompareRow[]>(
    GROUP_TITLES.map(([id]) => [id, []])
  )
  for (const { group, row } of includeRows()) byGroup.get(group)!.push(row)

  const grouped = new Set(Object.values(FEATURE_GROUPS).flat())
  for (const [group, features] of Object.entries(FEATURE_GROUPS))
    for (const f of features) byGroup.get(group)!.push(featureRow(f))
  for (const f of FEATURES)
    if (!grouped.has(f)) byGroup.get("more")!.push(featureRow(f))

  // This delivered tool shares the analysis entitlement with future Reach tools.
  byGroup.get("atlas")!.splice(1, 0, {
    id: "atlas.libraryAccess",
    label: ATLAS_PER_CAPITA_LABEL,
    cells: {
      public: "no",
      free: "no",
      supporter: "no",
      pro: featuresOf("pro").includes("atlas.analysis") ? "yes" : "no",
      team: featuresOf("team").includes("atlas.analysis") ? "yes" : "no",
    },
  })

  for (const [id, label, pro, team] of [
    [
      "atlas.reachArea",
      "Larger service Reach: maximum envelope (km²), one time per calculation",
      "20,000",
      "40,000",
    ],
    [
      "atlas.reachLibraries",
      "Service Reach: maximum eligible libraries",
      "50",
      "100",
    ],
    ["atlas.analysisHourly", "New Reach calculations per hour", "20", "100"],
  ])
    byGroup.get("atlas")!.push({
      id: id!,
      label: label!,
      cells: cellsFrom("pro", "yes"),
      cellLabels: { pro, team },
    })
  byGroup.get("atlas")!.push({
    id: "atlas.transit",
    label: "Transit stops and lines",
    cells: cellsFrom("pro", "soon"),
  })

  return GROUP_TITLES.map(([id, title]) => ({
    id,
    title,
    rows: byGroup.get(id)!,
  })).filter((g) => g.rows.length > 0)
}

/** Keeps rows that at least one plan has today ("Only show what's available now"). */
export function availableNow(groups: CompareGroup[]): CompareGroup[] {
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) => Object.values(r.cells).includes("yes")),
    }))
    .filter((g) => g.rows.length > 0)
}

/** "Free", "£3/mo", "£600/yr": the compact price for a column header. */
export function shortPrice(price: PlanPrice): string {
  if (price === "free") return "Free"
  if (price.monthly) return price.monthly.replace("/month", "/mo")

  return (price.yearly ?? "").replace("/year", "/yr").replace(" ex VAT", "")
}

function amount(text: string | undefined): number | null {
  const match = /£\s*([\d,]+(?:\.\d+)?)/.exec(text ?? "")

  return match ? Number(match[1]!.replaceAll(",", "")) : null
}

/**
 * Whole months saved by paying yearly (£3/month vs £30/year → 2), or null
 * when the price has no monthly and yearly pair, or no saving.
 */
export function yearlySavingMonths(price: PlanPrice): number | null {
  if (price === "free") return null
  const monthly = amount(price.monthly)
  const yearly = amount(price.yearly)
  if (!monthly || yearly == null) return null
  const months = Math.round((monthly * 12 - yearly) / monthly)

  return months > 0 ? months : null
}

/** The rows the Atlas plans sheet shows, in order (its layer rows are its own). */
export const ATLAS_SHEET_ROW_IDS = [
  "every-library-record-with-hours-and-services",
  "search-the-map-and-lists",
  "follow-libraries-and-save-events",
  "atlas.export",
  "atlas.libraryAccess",
  "atlas.contextLayers",
  "atlas.analysis",
  "atlas.compare",
  "atlas.reachArea",
  "atlas.reachLibraries",
  "atlas.analysisHourly",
  "atlas.transit",
  "team.workspace",
] as const

export function compareRowsById(ids: readonly string[]): CompareRow[] {
  const all = compareGroups().flatMap((g) => g.rows)

  return ids.flatMap((id) => all.filter((r) => r.id === id))
}

/** "£480/year ex VAT" → { amount: "£480", period: "year", suffix: " ex VAT" }. */
export function splitPrice(
  text: string | undefined
): { amount: string; period: string; suffix: string } | null {
  const slash = text?.indexOf("/") ?? -1
  if (!text || slash === -1) return null
  const amount = text.slice(0, slash)
  if (!/^£[\d,.]+$/.test(amount)) return null
  const rest = text.slice(slash + 1)
  const space = rest.indexOf(" ")
  const period = space === -1 ? rest : rest.slice(0, space)

  return period
    ? { amount, period, suffix: space === -1 ? "" : rest.slice(space) }
    : null
}
