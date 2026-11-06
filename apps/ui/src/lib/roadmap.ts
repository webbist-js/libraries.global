/** Community Roadmap content, engagement and the pure helpers its views share. */

export const ROADMAP_STAGES = ["now", "next", "later"] as const
export type RoadmapStage = (typeof ROADMAP_STAGES)[number]

export const ROADMAP_AREAS = [
  "atlas",
  "watching",
  "widgets",
  "teams",
  "events",
  "data",
] as const
export type RoadmapArea = (typeof ROADMAP_AREAS)[number]

/** Offer a feature is intended for: Explorer (free), Contributor, Verified Staff or API. */
export const ROADMAP_PLANS = ["free", "contributor", "staff", "api"] as const
export type RoadmapPlan = (typeof ROADMAP_PLANS)[number]

/** Where a dataset is: on our list, one of the four steps, or in the index. */
export const IMPORT_STAGES = [
  "listed",
  "exploring",
  "validating",
  "licensing",
  "ingesting",
  "ingested",
] as const
export type ImportStage = (typeof IMPORT_STAGES)[number]
/** The four steps every dataset goes through, in order. */
export const IMPORT_STEPS = [
  "explore",
  "validate",
  "licence",
  "ingest",
] as const

export type RoadmapFeature = {
  key: string
  title: string
  description: string
  stage: RoadmapStage
  area: RoadmapArea
  plans: { plan: RoadmapPlan; detail: string | null }[]
  noteKind: "target" | "testing" | "depends" | null
  note: string | null
}

export type RoadmapDataImport = {
  key: string
  place: string
  regions: string | null
  code: string
  source: string
  fields: string[]
  /** Libraries in the source; once ingested, the libraries it added. */
  libraries: number | null
  stage: ImportStage
  stageNote: string | null
}

export type RoadmapContent = {
  title: string
  lead: string | null
  features: RoadmapFeature[]
  dataTitle: string | null
  dataLead: string | null
  dataImports: RoadmapDataImport[]
  suggestPrompt: string | null
  footnote: string | null
}

export type RoadmapEngagement = {
  votes: number
  posts: number
  activityAt: string | null
  /** The item's visible thread; its Discuss button links there. */
  threadId: string | null
}

export type RoadmapSuggestion = {
  key: string
  place: string
  source: string
  sourceUrl: string | null
  licence: string | null
  createdAt: string
}

export type RoadmapEngagementData = {
  engagement: Record<string, RoadmapEngagement>
  voted: string[]
  suggestions: RoadmapSuggestion[]
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null
const oneOf = <T extends string>(
  options: readonly T[],
  value: unknown
): T | null => (options.includes(value as T) ? (value as T) : null)

/** Keeps only well-formed items; a malformed entry never breaks the page. */
export function normaliseRoadmap(value: unknown): RoadmapContent | null {
  const raw = record(value)
  const title = text(raw.title)
  if (!title) return null
  const features = (Array.isArray(raw.features) ? raw.features : []).flatMap(
    (item): RoadmapFeature[] => {
      const f = record(item)
      const key = text(f.key)
      const featureTitle = text(f.title)
      const stage = oneOf(ROADMAP_STAGES, f.stage)
      const area = oneOf(ROADMAP_AREAS, f.area)
      if (!key || !featureTitle || !stage || !area) return []

      return [
        {
          key,
          title: featureTitle,
          description: text(f.description) ?? "",
          stage,
          area,
          plans: (Array.isArray(f.plans) ? f.plans : []).flatMap((p) => {
            const plan = oneOf(ROADMAP_PLANS, record(p).plan)

            return plan ? [{ plan, detail: text(record(p).detail) }] : []
          }),
          noteKind: oneOf(["target", "testing", "depends"], f.noteKind),
          note: text(f.note),
        },
      ]
    }
  )
  const dataImports = (
    Array.isArray(raw.dataImports) ? raw.dataImports : []
  ).flatMap((item): RoadmapDataImport[] => {
    const d = record(item)
    const key = text(d.key)
    const place = text(d.place)
    const source = text(d.source)
    const stage = oneOf(IMPORT_STAGES, d.stage)
    if (!key || !place || !source || !stage) return []

    return [
      {
        key,
        place,
        regions: text(d.regions),
        code: text(d.code)?.toUpperCase().slice(0, 3) ?? place.slice(0, 2),
        source,
        fields: (Array.isArray(d.fields) ? d.fields : []).flatMap((field) => {
          const label = text(record(field).text)

          return label ? [label] : []
        }),
        libraries: count(d.libraries),
        stage,
        stageNote: text(d.stageNote),
      },
    ]
  })

  return {
    title,
    lead: text(raw.lead),
    features,
    dataTitle: text(raw.dataTitle),
    dataLead: text(raw.dataLead),
    dataImports,
    suggestPrompt: text(raw.suggestPrompt),
    footnote: text(raw.footnote),
  }
}

export type FeatureFilter = {
  area: RoadmapArea | "all"
  plan: RoadmapPlan | "any"
}

export function filterFeatures(
  features: readonly RoadmapFeature[],
  { area, plan }: FeatureFilter
): RoadmapFeature[] {
  return features.filter(
    (feature) =>
      (area === "all" || feature.area === area) &&
      (plan === "any" || feature.plans.some((p) => p.plan === plan))
  )
}

/** Areas that have at least one feature, in their fixed order. */
export function usedAreas(features: readonly RoadmapFeature[]): RoadmapArea[] {
  const used = new Set(features.map((feature) => feature.area))

  return ROADMAP_AREAS.filter((area) => used.has(area))
}

/**
 * Steps an import has finished (0 to 4), and the one it's on, if any: an
 * import on our list hasn't started, and an ingested one has finished.
 */
export function importProgress(stage: ImportStage): {
  done: number
  current: number | null
} {
  const index = IMPORT_STAGES.indexOf(stage)
  if (stage === "listed") return { done: 0, current: null }
  if (stage === "ingested") return { done: IMPORT_STEPS.length, current: null }

  return { done: index - 1, current: index - 1 }
}

/** Whole days since the last activity, or null when it's over 30 days old. */
export function activityAge(
  activityAt: string | null | undefined,
  now: number
): number | null {
  if (!activityAt) return null
  const then = Date.parse(activityAt)
  if (!Number.isFinite(then)) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = new Date(then)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((start.getTime() - day.getTime()) / 86_400_000)

  return days >= 0 && days <= 30 ? days : null
}

export const roadmapAnchor = (key: string) => `roadmap-${key}`
