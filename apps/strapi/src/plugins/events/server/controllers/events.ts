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
} from "../utils/query"
import { isValidServiceSecret } from "../utils/service-secret"

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
    const continent = asString(query.continent)
    const country = asString(query.country)
    const region = asString(query.region)
    const { start, limit } = pageWindow(query, { def: 20, max: 100 })

    const libraryFilters: Record<string, unknown> = {}
    if (continent)
      libraryFilters["area.region.country.continent.slug"] = continent
    if (country) libraryFilters["area.region.country.slug"] = country
    if (region) libraryFilters["area.region.slug"] = region

    const libraries = await strapi.documents(LIBRARY_UID).findMany({
      filters: libraryFilters,
      fields: ["entityRef"],
      status: "published",
      sort: ["id:asc"],
      limit: 500,
    })
    const refs = (libraries as any[])
      .map((l: any) => l.entityRef as string)
      .filter(Boolean)
    if (!refs.length) {
      ctx.body = []

      return
    }

    ctx.body = await strapi.documents(EVENT_UID).findMany({
      filters: publicEventFilters({
        libraryEntityRef: { $in: refs },
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
    const db = strapi.db.connection

    const startTime: Record<string, string> = { $gte: from }
    if (to) startTime.$lte = to
    const filters = publicEventFilters({
      startTime,
      ...(types.length === 1
        ? { eventType: types[0] }
        : types.length > 1
          ? { eventType: { $in: types } }
          : {}),
      ...(isFree != null ? { isFree: isFree === "true" } : {}),
    })

    // Count with the same filters using knex
    const countQuery = db("ev_events").count("* as total")
    countQuery.where("start_time", ">=", from)
    countQuery.whereIn("status", [...PUBLIC_EVENT_STATUSES])
    countQuery.where("pending_review", false)
    if (to) countQuery.where("start_time", "<=", to)
    if (types.length === 1) countQuery.where("event_type", types[0])
    else if (types.length > 1) countQuery.whereIn("event_type", types)
    if (isFree != null) countQuery.where("is_free", isFree === "true")
    const [countRow] = await countQuery
    const total = Number((countRow as any)?.total ?? 0)

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
    ctx.body = await computeEventStats(strapi)
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
        .groupBy("source_provider")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        provider: r.provider as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] providerBreakdown failed", err)
      ctx.body = []
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
      ctx.body = []
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
        .groupBy("event_type")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        type: r.type as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] categoryBreakdown failed", err)
      ctx.body = []
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
        .groupByRaw("DATE(start_time)")
        .orderBy("date", "asc")

      ctx.body = (rows as any[]).map((r) => ({
        date: r.date as string,
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] dailyVolume failed", err)
      ctx.body = []
    }
  },

  async countryBreakdown(ctx: any) {
    // TODO: countryCode/regionSlug removed from event schema — this handler
    // needs to derive country via the library relation join instead.
    // Until then it returns empty so the UI falls back gracefully.
    ctx.body = []
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
        .groupByRaw("1, 2")

      ctx.body = (rows as any[]).map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        count: Number(r.count),
      }))
    } catch (err) {
      strapi.log.error("[events] heatmap failed", err)
      ctx.body = []
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

  async submitCredential(ctx: any) {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"])) {
      ctx.status = 403
      ctx.body = { error: "Forbidden" }

      return
    }

    const {
      provider,
      label,
      libraryDocumentId,
      credentials,
      submittedByBaUserId,
    } = ctx.request.body as {
      provider: string
      label: string
      libraryDocumentId: string
      credentials: Record<string, unknown>
      submittedByBaUserId?: string
    }

    const VALID_PROVIDERS = [
      "eventbrite",
      "ticketsource",
      "meetup",
      "ical",
      "wegottickets",
      "spydus",
      "bibliocommons",
    ]
    if (!VALID_PROVIDERS.includes(provider)) {
      ctx.status = 400
      ctx.body = { error: "Invalid provider" }

      return
    }
    if (
      !label?.trim() ||
      !libraryDocumentId ||
      !credentials ||
      typeof credentials !== "object"
    ) {
      ctx.status = 400
      ctx.body = { error: "Missing required fields" }

      return
    }

    // Sanitize: only string values, bounded lengths
    const sanitized: Record<string, string> = {}
    for (const [k, v] of Object.entries(credentials)) {
      if (typeof v === "string") {
        sanitized[String(k).slice(0, 64)] = v.slice(0, 2048)
      }
    }

    const result = await strapi
      .plugin("events")
      .service("credentials")
      .create({
        provider,
        label: label.trim().slice(0, 200),
        scope: "library",
        isActive: false,
        libraryDocumentIds: [libraryDocumentId],
        credentials: sanitized,
      })

    strapi.log.info(
      `[events] Credential submitted for library ${libraryDocumentId} by ${submittedByBaUserId ?? "unknown"} — pending review`
    )

    ctx.status = 201
    ctx.body = { ok: true, documentId: (result as any).documentId ?? null }
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
