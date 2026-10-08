import {
  addDays,
  cancelledDates,
  localDateTime,
  normalizeMobileTimetable,
  stopKeys,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

import { noticesForLibraries, noticesForLibrary } from "./library-notices"

export const MOBILE_STOP_INDEX = "mobile-stop"
export const MOBILE_STOP_SETTINGS = {
  searchableAttributes: ["name", "where", "library_name", "area_name"],
  filterableAttributes: [
    "_geo",
    "geo_cell",
    "visit_keys",
    "cancelled_dates",
    "library_document_id",
    "area_slug",
    "region_slug",
    "country_slug",
    "kind",
    "shares_live",
    "timezone",
    // Keyset paging for region and area stop lists: `id > last`, sorted by id.
    "id",
    "stop_id",
  ],
  sortableAttributes: ["_geo", "name", "id", "stop_id"],
  displayedAttributes: [
    "id",
    "name",
    "where",
    "library_name",
    "library_slug",
    "library_path",
    "library_document_id",
    "area_slug",
    "area_name",
    "region_slug",
    "country_slug",
    "_geo",
    "geo_cell",
    "visit_keys",
    "cancelled_dates",
    "cycle",
    "visits",
    "kind",
    "shares_live",
    "timezone",
    "stop_id",
  ],
  pagination: { maxTotalHits: 1000 },
  // geo_cell clusters the world view: the densest cells must come first.
  faceting: {
    maxValuesPerFacet: 10000,
    sortFacetValuesBy: { "*": "alpha", geo_cell: "count" },
  },
}
const LIBRARY = "api::library.library"
const work = new Map<string, Promise<void>>()

export function mobileStopDocuments(
  library: Record<string, any>,
  notices: TimetableNotice[],
  today: string,
  sharesLive = false,
  areas = new Map<string, { slug: string; name: string }>()
) {
  const tt = normalizeMobileTimetable(library.mobileTimetable)
  if (
    library.libraryType !== "Mobile" ||
    library.operationalStatus === "permanently_closed" ||
    !tt
  )
    return []
  const path = [
    library.continent?.slug,
    library.country?.slug,
    library.region?.slug,
    library.slug,
  ]

  return tt.stops.flatMap((stop) => {
    const visits = tt.visits.filter((visit) => visit.stopId === stop.id)
    if (!visits.length || !stop.location) return []
    const area = stop.areaDocumentId ? areas.get(stop.areaDocumentId) : null

    return [
      {
        id: `${library.documentId}_${stop.id}`,
        stop_id: stop.id,
        name: stop.name,
        where: stop.where,
        library_name: library.name,
        library_slug: library.slug,
        library_document_id: library.documentId,
        library_path: path.every(Boolean) ? `/${path.join("/")}` : null,
        area_slug: area?.slug ?? null,
        area_name: area?.name ?? null,
        region_slug: library.region?.slug ?? null,
        country_slug: library.country?.slug ?? null,
        ...(stop.location
          ? {
              _geo: stop.location,
              geo_cell: `${Math.floor(stop.location.lat)},${Math.floor(stop.location.lng)}`,
            }
          : {}),
        visit_keys: stopKeys(tt, stop.id, today),
        cancelled_dates: cancelledDates(tt, notices, stop.id, today, 60),
        cycle: tt.cycle,
        visits,
        kind: "stop",
        shares_live: sharesLive,
        timezone: library.timezone ?? "UTC",
      },
    ]
  })
}

async function meili(
  strapi: any,
  path: string,
  method: string,
  body?: unknown
) {
  const config = strapi.config?.get?.("plugin.meilisearch") ?? {}
  const host =
    config.host ?? process.env.MEILISEARCH_HOST ?? "http://localhost:7701"
  const key =
    config.apiKey ??
    process.env.MEILISEARCH_ADMIN_API_KEY ??
    process.env.MEILISEARCH_MASTER_KEY
  if (!key) return null
  const response = await fetch(new URL(path, host), {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(`Mobile stop index ${method} returned ${response.status}`)

  return response.json()
}

export async function syncMobileStops(strapi: any, id: string): Promise<void> {
  const previous = work.get(id) ?? Promise.resolve()
  const next = previous
    .catch(() => {})
    .then(async () => {
      const library = await strapi.documents(LIBRARY).findOne({
        documentId: id,
        status: "published",
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
        },
      })
      let docs: ReturnType<typeof mobileStopDocuments> = []
      if (library) {
        const tt = normalizeMobileTimetable(library.mobileTimetable)
        const areaIds = [
          ...new Set(
            tt?.stops.flatMap((stop) =>
              stop.areaDocumentId ? [stop.areaDocumentId] : []
            )
          ),
        ]
        const [notices, areas, setting] = await Promise.all([
          noticesForLibrary(strapi, id),
          areaIds.length
            ? strapi.documents("api::area.area").findMany({
                filters: { documentId: { $in: areaIds } },
                fields: ["slug", "name"],
                status: "published",
                limit: 300,
              })
            : [],
          strapi.documents("plugin::mobile-libraries.live-setting").findMany({
            filters: { library: { documentId: { $eq: id } } },
            fields: ["enabled"],
            limit: 1,
          }),
        ])
        docs = mobileStopDocuments(
          library,
          notices,
          localDateTime(new Date(), library.timezone ?? "UTC").date,
          setting[0]?.enabled === true,
          new Map(
            areas.map((area: any) => [
              area.documentId,
              { slug: area.slug, name: area.name },
            ])
          )
        )
      }
      await meili(
        strapi,
        `/indexes/${MOBILE_STOP_INDEX}/documents/delete`,
        "POST",
        { filter: `library_document_id = ${JSON.stringify(id)}` }
      )
      for (let offset = 0; offset < docs.length; offset += 1000)
        await meili(
          strapi,
          `/indexes/${MOBILE_STOP_INDEX}/documents?primaryKey=id`,
          "PUT",
          docs.slice(offset, offset + 1000)
        )
    })
  work.set(id, next)
  try {
    await next
  } finally {
    if (work.get(id) === next) work.delete(id)
  }
}
export async function rebuildMobileStopIndex(strapi: any): Promise<void> {
  await meili(strapi, "/indexes", "POST", {
    uid: MOBILE_STOP_INDEX,
    primaryKey: "id",
  })
  await meili(
    strapi,
    `/indexes/${MOBILE_STOP_INDEX}/settings`,
    "PATCH",
    MOBILE_STOP_SETTINGS
  )
  for (let start = 0; ; start += 100) {
    const rows = await strapi.documents(LIBRARY).findMany({
      filters: { libraryType: "Mobile" },
      fields: ["documentId"],
      status: "published",
      sort: "id:asc",
      start,
      limit: 100,
    })
    for (const row of rows) await syncMobileStops(strapi, row.documentId)
    if (rows.length < 100) break
  }
}
export function mobileBoundaryNeedsRefresh(
  tt: MobileTimetable | null,
  notices: TimetableNotice[],
  date: string
): boolean {
  const yesterday = addDays(date, -1)

  return (
    Boolean(
      tt?.visits.some(
        (visit) => visit.validFrom === date || visit.validTo === yesterday
      )
    ) ||
    notices.some(
      (notice) =>
        notice.from === date ||
        (notice.to ?? addDays(notice.from, 29)) === yesterday ||
        (!notice.endedAt &&
          notice.from <= date &&
          (notice.to ?? addDays(notice.from, 29)) >= date &&
          notice.type === "not_running")
    )
  )
}
export async function refreshMobileLibraryFrames(
  strapi: any,
  id: string
): Promise<void> {
  const service = strapi.plugin("meilisearch")?.service?.("meilisearch")
  if (typeof service?.updateEntriesInMeilisearch !== "function") return
  const entries = await strapi.documents(LIBRARY).findMany({
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
      amenities: true,
      services: true,
    },
  })
  if (entries.length)
    await service.updateEntriesInMeilisearch({ contentType: LIBRARY, entries })
}
/** The time zones of published Mobile libraries, from one grouped query. */
async function mobileTimezones(strapi: any): Promise<(string | null)[]> {
  const meta = strapi.db?.metadata?.get?.(LIBRARY)
  const knex = strapi.db?.connection
  if (!meta?.tableName || typeof knex !== "function") return []
  const rows = (await knex(meta.tableName)
    .where({ library_type: "Mobile" })
    .whereNotNull("published_at")
    .distinct("timezone")) as { timezone: string | null }[]

  return rows.map((row) => row.timezone)
}

/**
 * Hourly: refresh the Mobile libraries whose local clock just passed
 * midnight. Only the zones now at 00:xx are read, by keyset (`id > after`),
 * with one notices query per page (1.6).
 */
export async function refreshMobileAtLocalMidnight(
  strapi: any,
  now = new Date()
): Promise<void> {
  const zones = await mobileTimezones(strapi)
  const due = zones.filter((zone) => {
    try {
      return localDateTime(now, zone ?? "UTC").minute < 60
    } catch {
      return false
    }
  })
  if (!due.length) return
  const timezoneFilter = {
    $or: [
      { timezone: { $in: due.filter((zone): zone is string => !!zone) } },
      ...(due.includes(null) ? [{ timezone: { $null: true } }] : []),
    ],
  }
  let after = 0
  for (;;) {
    const rows = await strapi.documents(LIBRARY).findMany({
      filters: {
        libraryType: "Mobile",
        id: { $gt: after },
        ...timezoneFilter,
      },
      fields: ["id", "documentId", "timezone", "mobileTimetable"],
      status: "published",
      sort: "id:asc",
      limit: 100,
    })
    if (!rows.length) break
    after = rows.at(-1)!.id
    // Read the preceding date too: notices that ended yesterday disappear from the public list today.
    const notices = await noticesForLibraries(
      strapi,
      rows.map((row: any) => row.documentId),
      new Date(now.getTime() - 86_400_000)
    )
    for (const row of rows) {
      const local = localDateTime(now, row.timezone ?? "UTC")
      if (local.minute >= 60) continue
      const boundary = mobileBoundaryNeedsRefresh(
        normalizeMobileTimetable(row.mobileTimetable),
        notices.get(row.documentId) ?? [],
        local.date
      )
      if (boundary) await syncMobileStops(strapi, row.documentId)
      if (boundary || local.weekday === "mon")
        await refreshMobileLibraryFrames(strapi, row.documentId)
    }
    if (rows.length < 100) break
  }
}
export function registerMobileStopIndex(strapi: any): void {
  const guardedSync = (id: string) =>
    syncMobileStops(strapi, id).catch((error) =>
      strapi.log.warn("[mobile-stop] Synchronisation failed", error)
    )
  /**
   * Only a library that is Mobile, or was Mobile before this write, reaches
   * Meilisearch (2.7). The type comes from the written data or the result;
   * one indexed column read covers a delete, an unpublish, a type written
   * away from Mobile, or a result without the field. A bulk import of
   * branches therefore makes no network call.
   */
  const typeOf = async (id: string) =>
    (
      await strapi.db
        .query(LIBRARY)
        .findOne({ where: { documentId: id }, select: ["libraryType"] })
    )?.libraryType
  strapi.documents.use(async (context: any, next: () => Promise<any>) => {
    const relevant =
      context.uid === LIBRARY &&
      ["publish", "unpublish", "delete", "update"].includes(context.action)
    const id: string | undefined = relevant
      ? context.params?.documentId
      : undefined
    const written = context.params?.data?.libraryType
    const before =
      id &&
      (["delete", "unpublish"].includes(context.action) ||
        (typeof written === "string" && written !== "Mobile"))
        ? await typeOf(id)
        : undefined
    const result = await next()
    const documentId = relevant ? (id ?? result?.documentId) : undefined
    if (documentId) {
      const after =
        written ??
        (Array.isArray(result?.entries) ? result.entries[0] : result)
          ?.libraryType ??
        (context.action === "delete" ? undefined : await typeOf(documentId))
      if (before === "Mobile" || after === "Mobile")
        await guardedSync(documentId)
    }

    return result
  })
  strapi.cron.add({
    "mobile-local-midnight": {
      options: { rule: "7 * * * *" },
      task: () =>
        refreshMobileAtLocalMidnight(strapi).catch((error) =>
          strapi.log.warn("[mobile-stop] Midnight refresh failed", error)
        ),
    },
  })
  meili(strapi, "/indexes", "POST", {
    uid: MOBILE_STOP_INDEX,
    primaryKey: "id",
  })
    .then(() =>
      meili(
        strapi,
        `/indexes/${MOBILE_STOP_INDEX}/settings`,
        "PATCH",
        MOBILE_STOP_SETTINGS
      )
    )
    .catch((error) =>
      strapi.log.warn("[mobile-stop] Index settings unavailable", error)
    )
}
