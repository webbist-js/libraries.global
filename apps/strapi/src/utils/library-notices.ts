import {
  libraryTypeName,
  checkText,
  noticeAddDays,
  noticeLocalDate,
  localDateTime,
  type LibraryNotice,
} from "@repo/shared-data"

import { sanitizeOpeningTimes } from "../plugins/content-moderation/server/utils/library-record"

export const LIBRARY_NOTICE_UID = "api::library-notice.library-notice"
/** Refresh dated branch hours and the rolling closure window at local midnight. */
export async function refreshBranchNoticesAtMidnight(
  strapi: any,
  now = new Date()
): Promise<void> {
  const earliest = noticeAddDays(now.toISOString().slice(0, 10), -2),
    latest = noticeAddDays(now.toISOString().slice(0, 10), 62)
  const refreshed = new Set<string>()
  for (let start = 0; ; start += 100) {
    const rows = await strapi.documents(LIBRARY_NOTICE_UID).findMany({
      filters: {
        endedAt: { $null: true },
        type: { $in: ["closure", "changed_hours"] },
        from: { $lte: latest },
        $or: [
          { to: { $gte: earliest } },
          {
            to: { $null: true },
            from: { $gte: noticeAddDays(earliest, -30) },
          },
        ],
      },
      populate: {
        library: {
          populate: { libraryType: { fields: ["name"] } },
          fields: ["documentId", "timezone"],
        },
      },
      sort: "id:asc",
      start,
      limit: 100,
    })
    for (const row of rows) {
      const library = row.library,
        id = library?.documentId
      if (
        !id ||
        libraryTypeName(library.libraryType) === "Mobile" ||
        refreshed.has(id)
      )
        continue
      const local = localDateTime(now, library.timezone ?? "UTC")
      if (local.minute >= 60) continue
      refreshed.add(id)
      await refreshNoticeEffects(strapi, id)
    }
    if (rows.length < 100) break
  }
}
const BRANCH_TYPES = ["closure", "changed_hours", "service"]
const MOBILE_TYPES = [
  "not_running",
  "times_changed",
  "stop_moved",
  "extra_visit",
]
const REASONS = new Set([
  "holiday",
  "school_holidays",
  "maintenance",
  "breakdown",
  "weather",
  "staffing",
  "works",
  "other",
])
const DAY = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
const validDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v

export class NoticeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code
  ) {
    super(message)
  }
}
export function normalizeNotice(
  input: unknown,
  library: any
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new NoticeError(400, "invalid_notice")
  const body = input as Record<string, unknown>,
    mobile = libraryTypeName(library.libraryType) === "Mobile"
  if (!(mobile ? MOBILE_TYPES : BRANCH_TYPES).includes(String(body.type)))
    throw new NoticeError(400, "invalid_type")
  if (
    !validDate(body.from) ||
    (body.to != null && (!validDate(body.to) || body.to < body.from))
  )
    throw new NoticeError(
      400,
      "invalid_dates",
      "Choose valid dates, with the end on or after the start."
    )
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message || message.length > 280)
    throw new NoticeError(
      400,
      "message_required",
      "Write the message people will see."
    )
  const unsafe = checkText(message, [library.name ?? ""])
  if (unsafe) throw new NoticeError(400, "unsafe_content", unsafe)
  const scope = mobile ? (body.scope ?? "service") : "library"
  if (
    (!mobile && body.scope && body.scope !== "library") ||
    !["library", "service", "day", "stop", "term_time"].includes(String(scope))
  )
    throw new NoticeError(400, "invalid_scope")
  let scopeWeek: number | null = null,
    scopeDay: string | null = null,
    stopId: string | null = null
  if (scope === "day") {
    if (
      !Number.isInteger(body.scopeWeek) ||
      Number(body.scopeWeek) < 1 ||
      Number(body.scopeWeek) > (library.mobileTimetable?.cycle?.weeks ?? 1) ||
      !DAY.has(String(body.scopeDay))
    )
      throw new NoticeError(400, "invalid_day_scope")
    scopeWeek = Number(body.scopeWeek)
    scopeDay = String(body.scopeDay)
  }
  if (scope === "stop") {
    if (
      typeof body.stopId !== "string" ||
      !library.mobileTimetable?.stops?.some(
        (stop: any) => stop.id === body.stopId
      )
    )
      throw new NoticeError(400, "invalid_stop")
    stopId = body.stopId
  }
  if (scope === "term_time" && body.type !== "not_running")
    throw new NoticeError(
      400,
      "invalid_scope",
      "Term-time notices must be a not-running notice."
    )
  if (body.reason != null && !REASONS.has(String(body.reason)))
    throw new NoticeError(400, "invalid_reason")
  const hours =
    body.type === "changed_hours" ? sanitizeOpeningTimes(body.hours) : null
  if (body.type === "changed_hours" && !hours)
    throw new NoticeError(
      400,
      "invalid_hours",
      "Set the temporary hours without overlapping times."
    )

  return {
    type: body.type,
    scope,
    scopeWeek,
    scopeDay,
    stopId,
    reason: body.reason ?? null,
    from: body.from,
    to: body.to ?? null,
    message,
    hours,
  }
}
export function publicNotice(row: any): LibraryNotice {
  return {
    id: row.documentId,
    documentId: row.documentId,
    type: row.type,
    scope: row.scope ?? "library",
    scopeWeek: row.scopeWeek ?? null,
    scopeDay: row.scopeDay ?? null,
    stopId: row.stopId ?? null,
    reason: row.reason ?? null,
    from: row.from,
    to: row.to ?? null,
    message: row.message,
    hours: row.hours ?? null,
    endedAt: row.endedAt ?? null,
  }
}
export async function noticesForLibrary(
  strapi: any,
  id: string,
  now = new Date(),
  includeEnded = false
): Promise<LibraryNotice[]> {
  const library = await strapi.documents("api::library.library").findOne({
    documentId: id,
    status: "published",
    fields: ["documentId", "timezone"],
  })
  if (!library) return []
  const date = noticeLocalDate(now, library.timezone)
  const rows = await strapi.documents(LIBRARY_NOTICE_UID).findMany({
    filters: {
      library: { documentId: id },
      $or: [
        {
          endedAt: { $null: true },
          $or: [
            { to: { $gte: includeEnded ? noticeAddDays(date, -29) : date } },
            {
              to: { $null: true },
              from: { $gte: noticeAddDays(date, includeEnded ? -58 : -29) },
            },
          ],
        },
        ...(includeEnded
          ? [
              {
                endedAt: {
                  $gte: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
                },
              },
            ]
          : []),
      ],
    },
    sort: ["from:asc", "createdAt:desc"],
    limit: 500,
  })

  return rows.map(publicNotice)
}
/**
 * Active notices for up to a few hundred libraries in two queries, keyed by
 * library documentId: the same window as `noticesForLibrary`, judged against
 * each library's own local date. Libraries that aren't published get no key.
 */
export async function noticesForLibraries(
  strapi: any,
  ids: string[],
  now = new Date()
): Promise<Map<string, LibraryNotice[]>> {
  const result = new Map<string, LibraryNotice[]>()
  const unique = [...new Set(ids)]
  if (!unique.length) return result
  const libraries = (await strapi.documents("api::library.library").findMany({
    filters: { documentId: { $in: unique } },
    status: "published",
    fields: ["documentId", "timezone"],
    limit: unique.length,
  })) as { documentId: string; timezone?: string | null }[]
  if (!libraries.length) return result
  const dates = new Map(
    libraries.map((library) => [
      library.documentId,
      noticeLocalDate(now, library.timezone),
    ])
  )
  for (const id of dates.keys()) result.set(id, [])
  const earliest = [...dates.values()].sort()[0]!
  const limit = 5000
  const rows = await strapi.documents(LIBRARY_NOTICE_UID).findMany({
    filters: {
      library: { documentId: { $in: [...dates.keys()] } },
      endedAt: { $null: true },
      $or: [
        { to: { $gte: earliest } },
        { to: { $null: true }, from: { $gte: noticeAddDays(earliest, -29) } },
      ],
    },
    populate: { library: { fields: ["documentId"] } },
    sort: ["from:asc", "createdAt:desc"],
    limit,
  })
  if (rows.length >= limit)
    strapi.log?.warn?.(
      `[notices] Over ${limit} active notices across ${unique.length} libraries; some were skipped`
    )
  for (const row of rows) {
    const id = row.library?.documentId,
      date = id ? dates.get(id) : undefined
    if (!id || !date) continue
    const inWindow =
      row.to != null ? row.to >= date : row.from >= noticeAddDays(date, -29)
    if (inWindow) result.get(id)!.push(publicNotice(row))
  }

  return result
}

const INDEX_NOTICE_TTL_MS = 15_000
const INDEX_NOTICE_CACHE_MAX = 5000
const indexNoticeCache = new Map<
  string,
  { at: number; notices: LibraryNotice[] }
>()
type Waiter = {
  resolve: (notices: LibraryNotice[]) => void
  reject: (error: unknown) => void
}
let indexNoticeQueue = new Map<string, Waiter[]>()
let indexNoticeFlush: Promise<void> | null = null

/**
 * Notices for the search index's `transformEntry`, which the plugin calls
 * once per entry (and once per locale). Calls made in the same tick are
 * answered by one `$in` query per 100 libraries, and a short cache answers
 * the other locales of the same library (1.7).
 */
export function noticesForIndexing(
  strapi: any,
  id: string
): Promise<LibraryNotice[]> {
  const hit = indexNoticeCache.get(id)
  if (hit && Date.now() - hit.at < INDEX_NOTICE_TTL_MS)
    return Promise.resolve(hit.notices)

  return new Promise<LibraryNotice[]>((resolve, reject) => {
    indexNoticeQueue.set(id, [
      ...(indexNoticeQueue.get(id) ?? []),
      { resolve, reject },
    ])
    indexNoticeFlush ??= new Promise((done) =>
      setTimeout(() => {
        indexNoticeFlush = null
        flushIndexNotices(strapi).finally(done)
      }, 0)
    )
  })
}
async function flushIndexNotices(strapi: any): Promise<void> {
  const queue = indexNoticeQueue
  indexNoticeQueue = new Map()
  const ids = [...queue.keys()]
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100)
    try {
      const loaded = await noticesForLibraries(strapi, chunk)
      for (const id of chunk) {
        const notices = loaded.get(id) ?? []
        if (indexNoticeCache.size >= INDEX_NOTICE_CACHE_MAX)
          indexNoticeCache.clear()
        indexNoticeCache.set(id, { at: Date.now(), notices })
        for (const waiter of queue.get(id) ?? []) waiter.resolve(notices)
      }
    } catch (error) {
      for (const id of chunk)
        for (const waiter of queue.get(id) ?? []) waiter.reject(error)
    }
  }
}

/** A notice changed: the next index refresh must read it. */
export function forgetIndexedNotices(id: string): void {
  indexNoticeCache.delete(id)
}

export async function refreshNoticeEffects(
  strapi: any,
  id: string
): Promise<void> {
  forgetIndexedNotices(id)
  try {
    const service = strapi.plugin("meilisearch")?.service?.("meilisearch")
    if (typeof service?.updateEntriesInMeilisearch === "function") {
      const entries = await strapi.documents("api::library.library").findMany({
        filters: { documentId: id },
        status: "published",
        locale: "*",
        populate: {
          heroImage: true,
          continent: true,
          country: true,
          region: true,
          area: true,
          accessibility: true,
          services: true,
          amenities: true,
        },
      })
      if (entries.length)
        await service.updateEntriesInMeilisearch({
          contentType: "api::library.library",
          entries,
        })
    }
  } catch (e) {
    strapi.log.warn("[notices] Library search refresh failed", e)
  }
  try {
    const { syncMobileStops } = await import("./mobile-stop-index")
    await syncMobileStops(strapi, id)
  } catch (e) {
    strapi.log.warn("[notices] Mobile stops refresh failed", e)
  }
  strapi.eventHub?.emit?.("library-notice.changed", { libraryDocumentId: id })
}
