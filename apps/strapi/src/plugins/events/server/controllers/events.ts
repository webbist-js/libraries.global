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
        "registrationUrl",
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
        "registrationUrl",
        "libraryEntityRef",
      ],
    })
    ctx.body = events
  },

  async global(ctx: any) {
    const {
      type,
      isFree,
      country: _country,
      continent: _continent,
      from,
      to,
      limit = "20",
      page = "1",
    } = ctx.query as Record<string, string>
    const now = new Date().toISOString()

    const filters: Record<string, unknown> = {
      startTime: { $gte: from ?? now },
      status: { $in: ["upcoming", "ongoing"] },
    }
    if (to) (filters.startTime as any).$lte = to
    if (type) filters.eventType = type
    if (isFree != null) filters.isFree = isFree === "true"

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
        "timezone",
        "eventType",
        "isFree",
        "registrationUrl",
        "libraryEntityRef",
        "status",
      ],
    })
    ctx.body = events
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
    const db = strapi.db.connection
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [totalRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
    const [weekRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", weekLater)
    const [freeRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("is_free", true)

    const total = Number((totalRow as any).count)
    const totalThisWeek = Number((weekRow as any).count)
    const freeCount = Number((freeRow as any).count)

    ctx.body = {
      totalEvents: total,
      totalThisWeek,
      percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
    }
  },
})
