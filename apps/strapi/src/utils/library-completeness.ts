import { completenessOf, gapsOf, type GapKey } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

const LIBRARY = "api::library.library"

export type OpeningTimes = {
  days?: {
    day: string
    enabled?: boolean
    timeframes?: { startTime: string; endTime: string }[]
  }[]
} | null

/** The record fields completeness looks at (the same eight sections as the library page's "About this record" panel). */
export type CompletenessSource = {
  heroImage?: unknown
  openingTimes?: OpeningTimes
  streetAddress?: string | null
  location?: unknown
  accessibility?: unknown[] | null
  services?: unknown[] | null
  amenities?: unknown[] | null
  summary?: string | null
  description?: unknown
  collectionStats?: unknown[] | null
  foundedYear?: string | null
  openedYear?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  absentFacilities?: unknown
}

/** Scalar attributes completeness reads. */
export const COMPLETENESS_FIELDS = [
  "openingTimes",
  "streetAddress",
  "location",
  "summary",
  "description",
  "foundedYear",
  "openedYear",
  "website",
  "phone",
  "email",
  "absentFacilities",
] as const

/** Relations and components completeness reads, populated as ids only. */
export const COMPLETENESS_POPULATE = {
  heroImage: { fields: ["id"] },
  accessibility: { fields: ["id"] },
  services: { fields: ["id"] },
  amenities: { fields: ["id"] },
  collectionStats: { fields: ["id"] },
}

/** Every write key that can change a library's completeness. */
export const COMPLETENESS_TRIGGER_KEYS: readonly string[] = [
  ...COMPLETENESS_FIELDS,
  ...Object.keys(COMPLETENESS_POPULATE),
]

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

/** Opening hours as 7 arrays (Mon–Sun) of [startMin, endMin]; null when unknown. */
export function compactHours(o: OpeningTimes | undefined): number[][][] | null {
  const days = o?.days
  if (!Array.isArray(days)) return null
  const out = DAYS.map((key) => {
    const d = days.find((x) => x.day === key)
    if (!d?.enabled) return []

    return (d.timeframes ?? [])
      .filter((tf) => tf.startTime && tf.endTime)
      .map((tf) => [minutes(tf.startTime), minutes(tf.endTime)])
  })

  return out.some((d) => d.length > 0) ? out : null
}

/**
 * 0–100: the share of the eight record sections that have content. The
 * eight sections come from `@repo/shared-data`'s `GAPS` registry (the ones
 * flagged `completeness`). Note: blank strings no longer count as content —
 * the registry treats a blank or whitespace-only string as empty, where this
 * used to count any truthy string.
 */
export function computeCompleteness(l: CompletenessSource): number {
  return completenessOf(l).percent
}

/** The record's gaps (registry order), stored beside completeness. */
export function computeGaps(l: CompletenessSource): GapKey[] {
  return gapsOf(l)
}

type LibraryRow = {
  id: number
  documentId: string
  locale?: string | null
  publishedAt?: string | null
  completeness?: number | null
  gaps?: unknown
}

/**
 * Recompute one row's `completeness` and `gaps` and store them when either
 * changed. Writes go through `db.query` by row id so the draft and the
 * published version each get their own values (a Document Service update
 * would only touch the draft); the lifecycle ignores that write (see
 * `lifeCycles/entityRef.ts`).
 */
export async function refreshLibraryCompleteness(
  strapi: Core.Strapi,
  row: LibraryRow
): Promise<number | null> {
  try {
    const source = (await strapi.documents(LIBRARY).findOne({
      documentId: row.documentId,
      fields: [...COMPLETENESS_FIELDS] as never,
      populate: COMPLETENESS_POPULATE as never,
      status: row.publishedAt ? "published" : "draft",
      locale: row.locale ?? undefined,
    })) as CompletenessSource | null
    if (!source) return null
    const completeness = computeCompleteness(source)
    const gaps = computeGaps(source)
    if (
      completeness !== row.completeness ||
      JSON.stringify(gaps) !== JSON.stringify(row.gaps ?? null)
    ) {
      await strapi.db
        .query(LIBRARY)
        .update({ where: { id: row.id }, data: { completeness, gaps } })
    }

    return completeness
  } catch (err) {
    strapi.log.warn(`[completeness] ${row.documentId} not refreshed:`, err)

    return null
  }
}

const BACKFILL_PAGE = 200
const BACKFILL_MAX_PASSES = 1000

/**
 * One-off bootstrap pass: every row (draft and published, all locales) whose
 * `completeness` or `gaps` is still NULL gets both. A no-op once everything
 * is filled.
 */
export async function backfillLibraryCompleteness(
  strapi: Core.Strapi
): Promise<number> {
  let written = 0
  try {
    for (const status of ["draft", "published"] as const) {
      for (let pass = 0; pass < BACKFILL_MAX_PASSES; pass++) {
        const rows = (await strapi.documents(LIBRARY).findMany({
          filters: {
            $or: [{ completeness: { $null: true } }, { gaps: { $null: true } }],
          } as never,
          fields: [
            "documentId",
            "locale",
            "publishedAt",
            "completeness",
            "gaps",
            ...COMPLETENESS_FIELDS,
          ] as never,
          populate: COMPLETENESS_POPULATE as never,
          status,
          locale: "*",
          sort: "id:asc",
          limit: BACKFILL_PAGE,
        })) as unknown as (LibraryRow & CompletenessSource)[]
        if (rows.length === 0) break
        for (const row of rows) {
          await strapi.db.query(LIBRARY).update({
            where: { id: row.id },
            data: {
              completeness: computeCompleteness(row),
              gaps: computeGaps(row),
            },
          })
          written++
        }
        if (rows.length < BACKFILL_PAGE) break
      }
    }
    if (written > 0)
      strapi.log.info(`[completeness] backfilled ${written} library rows`)
  } catch (err) {
    strapi.log.error("[bootstrap] backfillLibraryCompleteness failed", err)
  }

  return written
}
