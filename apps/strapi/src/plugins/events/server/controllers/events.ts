import { isValidServiceSecret } from "../utils/service-secret"

export default ({ strapi }: { strapi: any }) => ({
  async library(ctx: any) {
    const { entityRef } = ctx.params as { entityRef: string }
    const {
      limit = "20",
      page = "1",
      type,
      isFree,
    } = ctx.query as Record<string, string>

    const filters: Record<string, unknown> = {
      libraryEntityRef: entityRef,
      startTime: { $gte: new Date().toISOString() },
      status: { $in: ["upcoming", "ongoing"] },
    }
    if (type) filters.eventType = type
    if (isFree != null) filters.isFree = isFree === "true"

    const results = await strapi.documents("plugin::events.event").findMany({
      filters,
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "allDay",
        "timezone",
        "eventType",
        "isFree",
        "priceMin",
        "priceMax",
        "status",
        "tags",
      ],
    })
    ctx.body = results
  },

  async location(ctx: any) {
    const {
      continent,
      country,
      region,
      limit = "20",
      page = "1",
    } = ctx.query as Record<string, string>

    const libraryFilters: Record<string, unknown> = {}
    if (continent)
      libraryFilters["area.region.country.continent.slug"] = continent
    if (country) libraryFilters["area.region.country.slug"] = country
    if (region) libraryFilters["area.region.slug"] = region

    const libraries = await strapi.documents("api::library.library").findMany({
      filters: libraryFilters,
      fields: ["entityRef"],
      pagination: { pageSize: 500 },
    })
    const refs = (libraries as any[])
      .map((l: any) => l.entityRef as string)
      .filter(Boolean)
    if (!refs.length) {
      ctx.body = []

      return
    }

    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        libraryEntityRef: { $in: refs },
        startTime: { $gte: new Date().toISOString() },
        status: { $in: ["upcoming", "ongoing"] },
      },
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "timezone",
        "eventType",
        "isFree",
        "libraryEntityRef",
      ],
    })
    ctx.body = events
  },

  async global(ctx: any) {
    const {
      type,
      isFree,
      from,
      to,
      limit = "20",
      page = "1",
    } = ctx.query as Record<string, string>
    const now = new Date().toISOString()
    const db = strapi.db.connection

    const filters: Record<string, unknown> = {
      startTime: { $gte: from ?? now },
      status: { $in: ["upcoming", "ongoing"] },
    }
    if (to) (filters.startTime as any).$lte = to
    if (type) {
      const types = type.split(",").filter(Boolean)
      filters.eventType = types.length === 1 ? types[0] : { $in: types }
    }
    if (isFree != null) filters.isFree = isFree === "true"

    // Count with same filters using knex
    const countQuery = db("ev_events").count("* as total")
    countQuery.where("start_time", ">=", from ?? now)
    countQuery.whereIn("status", ["upcoming", "ongoing"])
    if (to) countQuery.where("start_time", "<=", to)
    if (type) {
      const types = type.split(",").filter(Boolean)
      if (types.length === 1) countQuery.where("event_type", types[0])
      else countQuery.whereIn("event_type", types)
    }
    if (isFree != null) countQuery.where("is_free", isFree === "true")
    const [countRow] = await countQuery
    const total = Number((countRow as any).total)

    const events = await strapi.documents("plugin::events.event").findMany({
      filters,
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "allDay",
        "timezone",
        "eventType",
        "sourceProvider",
        "isFree",
        "priceMin",
        "priceMax",
        "status",
      ],
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
      page: Number(page),
      pageSize: Number(limit),
    }
  },

  async thisWeek(ctx: any) {
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        startTime: { $gte: now.toISOString(), $lte: weekLater.toISOString() },
        status: { $in: ["upcoming", "ongoing"] },
      },
      sort: ["startTime:asc"],
      pagination: { pageSize: 50 },
      fields: [
        "title",
        "url",
        "startTime",
        "eventType",
        "isFree",
        "libraryEntityRef",
      ],
    })
    ctx.body = events
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
        .groupBy("source_provider")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        provider: r.provider as string,
        count: Number(r.count),
      }))
    } catch {
      ctx.body = []
    }
  },

  async topLibraries(ctx: any) {
    try {
      const { limit = "10" } = ctx.query as Record<string, string>
      const db = strapi.db.connection
      const now = new Date()

      const rows = await db("ev_events")
        .select("library_entity_ref as entityRef")
        .count("* as count")
        .where("start_time", ">=", now)
        .whereNotNull("library_entity_ref")
        .groupBy("library_entity_ref")
        .orderBy("count", "desc")
        .limit(Number(limit))

      // Enrich with library names
      const refs = (rows as any[]).map((r) => r.entityRef as string)
      const libraries = refs.length
        ? await strapi.documents("api::library.library").findMany({
            filters: { entityRef: { $in: refs } },
            fields: ["name", "entityRef"],
            pagination: { pageSize: refs.length },
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
    } catch {
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
        .groupBy("event_type")
        .orderBy("count", "desc")

      ctx.body = (rows as any[]).map((r) => ({
        type: r.type as string,
        count: Number(r.count),
      }))
    } catch {
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
        .groupByRaw("DATE(start_time)")
        .orderBy("date", "asc")

      ctx.body = (rows as any[]).map((r) => ({
        date: r.date as string,
        count: Number(r.count),
      }))
    } catch {
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

      // Returns count per (dayOfWeek 0-6, hour 0-23) for next 4 weeks
      const rows = await db("ev_events")
        .select(
          db.raw("strftime('%w', start_time) as dow"),
          db.raw("CAST(strftime('%H', start_time) AS INTEGER) as hour"),
          db.raw("count(*) as count")
        )
        .where("start_time", ">=", now)
        .where("start_time", "<=", fourWeeks)
        .groupByRaw("dow, hour")

      ctx.body = (rows as any[]).map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        count: Number(r.count),
      }))
    } catch {
      ctx.body = []
    }
  },

  async featured(ctx: any) {
    const { count = "1" } = ctx.query as Record<string, string>
    const pageSize = Math.min(Math.max(1, Number(count)), 12)
    const now = new Date()
    const results = await strapi.documents("plugin::events.event").findMany({
      filters: {
        startTime: { $gte: now.toISOString() },
        status: { $in: ["upcoming", "ongoing"] },
        pendingReview: false,
      },
      sort: ["importedAt:desc"],
      pagination: { pageSize },
      fields: [
        "title",
        "description",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "allDay",
        "timezone",
        "eventType",
        "isFree",
        "priceMin",
        "priceMax",
        "status",
        "tags",
        "libraryEntityRef",
        "sourceProvider",
      ],
    })
    ctx.body = results as any[]
  },

  async event(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const event = await strapi
      .documents("plugin::events.event")
      .findOne({ documentId })
    if (!event) return ctx.notFound()
    ctx.body = event
  },

  async relatedEvents(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const source = await strapi
      .documents("plugin::events.event")
      .findOne({ documentId })
    if (!source) return ctx.notFound()

    const now = new Date().toISOString()
    const results = await strapi.documents("plugin::events.event").findMany({
      filters: {
        libraryEntityRef: source.libraryEntityRef ?? "",
        startTime: { $gte: now },
        documentId: { $ne: documentId },
      } as never,
      sort: ["startTime:asc"],
      pagination: { pageSize: 4 },
    })
    ctx.body = results
  },

  async icsGlobal(ctx: any) {
    const { buildIcs } = await import("../utils/ics")
    const now = new Date().toISOString()
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        startTime: { $gte: now, $lte: future },
      },
      sort: ["startTime:asc"],
      pagination: { pageSize: 500 },
    })

    const ics = buildIcs(
      (events as any[]).map((e: any) => ({
        uid: e.documentId,
        summary: e.title as string,
        description: (e.description as string | null) ?? null,
        dtstart: e.startTime as string,
        dtend: (e.endTime as string | null) ?? null,
        allDay: !!e.allDay,
        url: (e.url as string | null) ?? null,
        location: (e.libraryEntityRef as string | null) ?? null,
      })),
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
    const { buildIcs } = await import("../utils/ics")
    const { entityRef } = ctx.params as { entityRef: string }
    const now = new Date().toISOString()
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        libraryEntityRef: entityRef,
        startTime: { $gte: now, $lte: future },
      },
      sort: ["startTime:asc"],
      pagination: { pageSize: 200 },
    })

    const ics = buildIcs(
      (events as any[]).map((e: any) => ({
        uid: e.documentId,
        summary: e.title as string,
        description: (e.description as string | null) ?? null,
        dtstart: e.startTime as string,
        dtend: (e.endTime as string | null) ?? null,
        allDay: !!e.allDay,
        url: (e.url as string | null) ?? null,
        location: entityRef,
      })),
      `${entityRef} — Events`
    )

    ctx.set("Content-Type", "text/calendar; charset=utf-8")
    ctx.set(
      "Content-Disposition",
      `attachment; filename="${entityRef}-events.ics"`
    )
    ctx.body = ics
  },
})
