import { libraryJoin, tableOf } from "../../../../utils/library-sql"
import {
  PUBLIC_EVENT_FIELDS,
  PUBLIC_EVENT_SORT,
  PUBLIC_EVENT_STATUSES,
  asString,
  clampInt,
  dowHourSql,
  pageWindow,
  parseIsoDate,
  parseTypeList,
  publicEventFilters,
  eventLocationFilter,
} from "../utils/query"

const EVENT_UID = "plugin::events.event"
const LIBRARY_UID = "api::library.library"

const ICS_WINDOW_DAYS = 90

type IcsRow = Record<string, unknown> & { documentId: string }

const toIcsEvent = (e: IcsRow, location: string | null) => ({
  uid: e.documentId,
  summary: String(e.title ?? ""),
  description: (e.description as string | null) ?? null,
  dtstart: e.startTime as string,
  dtend: (e.endTime as string | null) ?? null,
  allDay: !!e.allDay,
  url: (e.url as string | null) ?? null,
  location,
})

export default ({ strapi }: { strapi: any }) => ({
  async library(ctx: any) {
    const { entityRef } = ctx.params as { entityRef: string }
    const query = ctx.query as Record<string, unknown>
    const { start, limit } = pageWindow(query, { def: 20, max: 100 })
    const type = asString(query.type)
    const isFree = asString(query.isFree)

    const filters = publicEventFilters({
      libraryEntityRef: entityRef,
      startTime: { $gte: new Date().toISOString() },
      ...(type ? { eventType: type } : {}),
      ...(isFree != null ? { isFree: isFree === "true" } : {}),
    })

    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters,
      sort: PUBLIC_EVENT_SORT,
      start,
      limit,
      fields: PUBLIC_EVENT_FIELDS,
    })
  },

  async location(ctx: any) {
    const query = ctx.query as Record<string, unknown>
    const { start, limit } = pageWindow(query, { def: 20, max: 100 })

    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        ...eventLocationFilter(query),
        startTime: { $gte: new Date().toISOString() },
      }),
      sort: PUBLIC_EVENT_SORT,
      start,
      limit,
      fields: PUBLIC_EVENT_FIELDS,
    })
  },

  async global(ctx: any) {
    const query = ctx.query as Record<string, unknown>
    const { start, limit, page } = pageWindow(query, { def: 20, max: 100 })
    const now = new Date().toISOString()
    const from = parseIsoDate(query.from) ?? now
    const to = parseIsoDate(query.to)
    const types = parseTypeList(query.type)
    const isFree = asString(query.isFree)

    const startTime: Record<string, string> = { $gte: from }
    if (to) startTime.$lte = to
    const filters = publicEventFilters({
      ...eventLocationFilter(query),
      startTime,
      ...(types.length === 1
        ? { eventType: types[0] }
        : types.length > 1
          ? { eventType: { $in: types } }
          : {}),
      ...(isFree != null ? { isFree: isFree === "true" } : {}),
    })

    // The count must use precisely the same relation and visibility predicates.
    const total = await strapi.documents(EVENT_UID).count({ filters })

    const events = await strapi.documents(EVENT_UID).findMany({
      filters,
      sort: PUBLIC_EVENT_SORT,
      start,
      limit,
      fields: PUBLIC_EVENT_FIELDS,
      populate: {
        library: { fields: ["name", "slug"] },
      },
    })

    ctx.body = {
      events: (events as any[]).map((e) => ({
        ...e,
        libraryName: e.library?.name ?? null,
        librarySlug: e.library?.slug ?? null,
        library: undefined,
      })),
      total,
      page,
      pageSize: limit,
    }
  },

  async thisWeek(ctx: any) {
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        startTime: { $gte: now.toISOString(), $lte: weekLater.toISOString() },
      }),
      sort: PUBLIC_EVENT_SORT,
      limit: 50,
      fields: PUBLIC_EVENT_FIELDS,
    })
  },

  async stats(ctx: any) {
    const { computeEventStats } = await import("../services/stats")
    try {
      ctx.body = await computeEventStats(strapi)
    } catch {
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async providerBreakdown(ctx: any) {
    try {
      const db = strapi.db.connection
      const now = new Date()

      const rows = await db("ev_events")
        .select("source_provider as provider")
        .count("* as count")
        .where("start_time", ">=", now)
        .where("pending_review", false)
        .whereIn("status", [...PUBLIC_EVENT_STATUSES])
        .groupBy("source_provider")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        provider: r.provider as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] providerBreakdown failed", err)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async topLibraries(ctx: any) {
    try {
      const limit = clampInt((ctx.query as Record<string, unknown>).limit, {
        def: 10,
        min: 1,
        max: 50,
      })
      const db = strapi.db.connection
      const now = new Date()

      const rows = await db("ev_events")
        .select("library_entity_ref as entityRef")
        .count("* as count")
        .where("start_time", ">=", now)
        .where("pending_review", false)
        .whereIn("status", [...PUBLIC_EVENT_STATUSES])
        .whereNotNull("library_entity_ref")
        .groupBy("library_entity_ref")
        .orderBy("count", "desc")
        .limit(limit)

      // Enrich with library names
      const refs = (rows as any[]).map((r) => r.entityRef as string)
      const libraries = refs.length
        ? await strapi.documents(LIBRARY_UID).findMany({
            filters: { entityRef: { $in: refs } },
            fields: ["name", "entityRef"],
            status: "published",
            sort: ["id:asc"],
            limit: refs.length,
          })
        : []

      const nameMap = new Map(
        (libraries as any[]).map((l: any) => [l.entityRef, l.name])
      )

      ctx.body = (rows as any[]).map((r) => ({
        entityRef: r.entityRef as string,
        name: (nameMap.get(r.entityRef) as string) ?? r.entityRef,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] topLibraries failed", err)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async categoryBreakdown(ctx: any) {
    try {
      const db = strapi.db.connection
      const now = new Date()

      const rows = await db("ev_events")
        .select("event_type as type")
        .count("* as count")
        .where("start_time", ">=", now)
        .where("pending_review", false)
        .whereIn("status", [...PUBLIC_EVENT_STATUSES])
        .groupBy("event_type")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        type: r.type as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] categoryBreakdown failed", err)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async dailyVolume(ctx: any) {
    try {
      const db = strapi.db.connection
      const now = new Date()
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const rows = await db("ev_events")
        .select(db.raw("DATE(start_time) as date"))
        .count("* as count")
        .where("start_time", ">=", now)
        .where("start_time", "<=", thirtyDays)
        .where("pending_review", false)
        .whereIn("status", [...PUBLIC_EVENT_STATUSES])
        .groupByRaw("DATE(start_time)")
        .orderBy("date", "asc")

      ctx.body = (rows as any[]).map((r) => ({
        date: r.date as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] dailyVolume failed", err)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async countryBreakdown(ctx: any) {
    try {
      const db = strapi.db.connection
      const country = libraryJoin(strapi, "country")
      const libraries = tableOf(strapi, LIBRARY_UID)
      const countryCodeColumn = strapi.db.metadata.get("api::country.country")
        .attributes.iso2.columnName
      if (typeof countryCodeColumn !== "string")
        throw new Error("Country code metadata is unavailable")
      const event = strapi.db.metadata.get(EVENT_UID)
      const link = event.attributes.library.joinTable
      const rows = await db(`${event.tableName} as event`)
        .join(`${link.name} as el`, "el." + link.joinColumn.name, "event.id")
        .join(
          `${libraries} as library`,
          "library.id",
          "el." + link.inverseJoinColumn.name
        )
        .join(
          `${country.linkTable} as lc`,
          "lc." + country.libraryColumn,
          "library.id"
        )
        .join(
          `${country.table} as country`,
          "country.id",
          "lc." + country.targetColumn
        )
        .select(`country.${countryCodeColumn} as countryCode`)
        .countDistinct("event.id as count")
        .where("event.start_time", ">=", new Date())
        .where("event.pending_review", false)
        .whereIn("event.status", [...PUBLIC_EVENT_STATUSES])
        .whereNotNull("library.published_at")
        .whereNotNull("country.published_at")
        .whereNotNull(`country.${countryCodeColumn}`)
        .groupBy(`country.${countryCodeColumn}`)
        .orderBy("count", "desc")
      ctx.body = rows.map((row: { countryCode: string; count: unknown }) => ({
        countryCode: row.countryCode,
        count: Number(row.count),
      }))
    } catch (error) {
      strapi.log.error("[events] countryBreakdown failed", error)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async heatmap(ctx: any) {
    try {
      const db = strapi.db.connection
      const now = new Date()
      const fourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
      const { dow, hour } = dowHourSql(strapi)

      // Returns count per (dayOfWeek 0-6, hour 0-23) for next 4 weeks
      const rows = await db("ev_events")
        .select(
          db.raw(`${dow} as dow`),
          db.raw(`${hour} as hour`),
          db.raw("count(*) as count")
        )
        .where("start_time", ">=", now)
        .where("start_time", "<=", fourWeeks)
        .where("pending_review", false)
        .whereIn("status", [...PUBLIC_EVENT_STATUSES])
        .groupByRaw("1, 2")

      ctx.body = (rows as any[]).map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] heatmap failed", err)
      ctx.status = 503
      ctx.body = { error: "Event analytics unavailable" }
    }
  },

  async featured(ctx: any) {
    const limit = clampInt((ctx.query as Record<string, unknown>).count, {
      def: 1,
      min: 1,
      max: 12,
    })
    const now = new Date()
    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        startTime: { $gte: now.toISOString() },
      }),
      sort: ["importedAt:desc", "id:asc"],
      limit,
      fields: PUBLIC_EVENT_FIELDS,
    })
  },

  async event(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    // A detail page may still show a cancelled or postponed event (the row
    // carries `status`), but never one awaiting review.
    const [event] = await strapi.documents(EVENT_UID).findMany({
      filters: { documentId, pendingReview: false },
      limit: 1,
      fields: PUBLIC_EVENT_FIELDS,
    })
    if (!event) return ctx.notFound()
    ctx.body = event
  },

  async relatedEvents(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const [source] = await strapi.documents(EVENT_UID).findMany({
      filters: { documentId, pendingReview: false },
      limit: 1,
      fields: ["libraryEntityRef"],
    })
    if (!source) return ctx.notFound()

    const now = new Date().toISOString()
    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        libraryEntityRef: source.libraryEntityRef ?? "",
        startTime: { $gte: now },
        documentId: { $ne: documentId },
      }),
      sort: PUBLIC_EVENT_SORT,
      limit: 4,
      fields: PUBLIC_EVENT_FIELDS,
    })
  },

  async icsGlobal(ctx: any) {
    const { buildIcs } = await import("../utils/ics")
    const now = new Date().toISOString()
    const future = new Date(
      Date.now() + ICS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    const events = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        startTime: { $gte: now, $lte: future },
      }),
      sort: PUBLIC_EVENT_SORT,
      limit: 500,
      fields: PUBLIC_EVENT_FIELDS,
    })

    const ics = buildIcs(
      (events as IcsRow[]).map((e) =>
        toIcsEvent(e, (e.libraryEntityRef as string | null) ?? null)
      ),
      "Libraries Global — Events"
    )

    ctx.set("Content-Type", "text/calendar; charset=utf-8")
    ctx.set(
      "Content-Disposition",
      'attachment; filename="libraries-events.ics"'
    )
    ctx.body = ics
  },

  async icsLibrary(ctx: any) {
    const { buildIcs, safeIcsFilename } = await import("../utils/ics")
    const { entityRef } = ctx.params as { entityRef: string }
    const now = new Date().toISOString()
    const future = new Date(
      Date.now() + ICS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    const events = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        libraryEntityRef: entityRef,
        startTime: { $gte: now, $lte: future },
      }),
      sort: PUBLIC_EVENT_SORT,
      limit: 200,
      fields: PUBLIC_EVENT_FIELDS,
    })

    const ics = buildIcs(
      (events as IcsRow[]).map((e) => toIcsEvent(e, entityRef)),
      `${entityRef} — Events`
    )

    ctx.set("Content-Type", "text/calendar; charset=utf-8")
    ctx.set(
      "Content-Disposition",
      `attachment; filename="${safeIcsFilename(entityRef)}-events.ics"`
    )
    ctx.body = ics
  },
})
