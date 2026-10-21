import { pageWindow } from "../utils/query"

const adminActor = (ctx: any) =>
  `admin:${(ctx.state?.user as any)?.id ?? "unknown"}`
const SLOTS = new Set(["current", "pending"])
const credentials = (strapi: any) =>
  strapi.plugin("events").service("credentials")

function badRequest(ctx: any, err: any) {
  ctx.status = err?.status === 400 ? 400 : 500
  ctx.body = {
    error: err?.status === 400 ? err.message : "Couldn't save the credential",
    field: err?.field,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  async searchLibraries(ctx: {
    query?: { q?: unknown }
    status?: number
    body?: unknown
  }) {
    const q = typeof ctx.query?.q === "string" ? ctx.query.q.trim() : ""
    if (q.length < 2 || q.length > 100) {
      ctx.status = 400
      ctx.body = { error: "Search must contain 2–100 characters" }

      return
    }
    ctx.body = {
      data: await strapi.documents("api::library.library").findMany({
        filters: { name: { $containsi: q } },
        fields: ["name", "entityRef"],
        status: "published",
        limit: 10,
        sort: ["name:asc", "id:asc"],
      }),
    }
  },
  async listCredentials(ctx: any) {
    ctx.body = await credentials(strapi).findAll()
  },

  async createCredential(ctx: any) {
    const {
      provider,
      label,
      scope,
      status,
      libraryDocumentIds,
      credentials: values,
    } = (ctx.request.body ?? {}) as Record<string, any>
    try {
      ctx.body = await credentials(strapi).create(
        {
          provider,
          label: String(label ?? ""),
          scope: scope === "group" ? "group" : "library",
          status,
          libraryDocumentIds,
          credentials: values,
        },
        adminActor(ctx)
      )
    } catch (err) {
      badRequest(ctx, err)
    }
  },

  async updateCredential(ctx: any) {
    const {
      label,
      status,
      libraryDocumentIds,
      credentials: values,
    } = (ctx.request.body ?? {}) as Record<string, any>
    try {
      const result = await credentials(strapi).update(
        ctx.params.documentId,
        {
          label,
          status:
            status === "active" || status === "paused" ? status : undefined,
          libraryDocumentIds,
          credentials: values,
        },
        adminActor(ctx)
      )
      if (!result) {
        ctx.status = 404

        return
      }
      ctx.body = result
    } catch (err) {
      badRequest(ctx, err)
    }
  },

  async deleteCredential(ctx: any) {
    await credentials(strapi).delete(ctx.params.documentId, adminActor(ctx))
    ctx.status = 204
  },

  async testCredential(ctx: any) {
    const slot = ctx.request?.body?.slot === "pending" ? "pending" : "current"
    const r = await credentials(strapi).test(
      ctx.params.documentId,
      slot,
      adminActor(ctx)
    )
    if (!r) {
      ctx.status = 404
      ctx.body = { error: "Nothing to test" }

      return
    }
    ctx.body = r
  },

  async revealCredential(ctx: any) {
    const slot = ctx.request?.body?.slot
    if (!SLOTS.has(slot)) {
      ctx.status = 400
      ctx.body = { error: "slot must be current or pending" }

      return
    }
    ctx.set("Cache-Control", "no-store")
    const data = await credentials(strapi).reveal(
      ctx.params.documentId,
      slot,
      adminActor(ctx)
    )
    if (!data) {
      ctx.status = 404
      ctx.body = { error: "No value in that slot" }

      return
    }
    ctx.body = { data }
  },

  async listRuns(ctx: any) {
    const { start, limit, page } = pageWindow(
      ctx.query as Record<string, unknown>,
      {
        def: 20,
        max: 100,
      }
    )
    const rows = await strapi.documents("plugin::events.import-run").findMany({
      sort: ["startedAt:desc", "id:desc"],
      start,
      limit,
    })
    const total = await strapi.documents("plugin::events.import-run").count({})
    ctx.body = { data: rows, meta: { total, page, pageSize: limit } }
  },

  async getRun(ctx: any) {
    const { runId } = ctx.params as { runId: string }
    const run = await strapi.documents("plugin::events.import-run").findMany({
      filters: { runId },
      limit: 1,
    })
    if (!run?.[0]) {
      ctx.status = 404

      return
    }
    ctx.body = run[0]
  },

  async triggerSync(ctx: any) {
    const userId = (ctx.state.user as any)?.id ?? null
    await strapi.documents("plugin::events.sync-command").create({
      data: {
        requestedAt: new Date().toISOString(),
        requestedByUserId: userId != null ? String(userId) : undefined,
      },
    })
    ctx.body = {
      ok: true,
      message: "Sync command queued — worker picks up within 2 minutes",
    }
  },

  async workerHealth(ctx: any) {
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      ctx.body = await res.json()
    } catch {
      ctx.body = { ok: false, status: "unreachable" }
    }
  },

  async listPendingReview(ctx: any) {
    const { start, limit, page } = pageWindow(
      ctx.query as Record<string, unknown>,
      {
        def: 20,
        max: 100,
      }
    )
    const results = await strapi.documents("plugin::events.event").findMany({
      filters: { pendingReview: true },
      sort: ["startTime:asc", "id:asc"],
      start,
      limit,
      fields: [
        "title",
        "startTime",
        "libraryEntityRef",
        "sourceProvider",
        "url",
      ],
    })
    const total = await strapi
      .documents("plugin::events.event")
      .count({ filters: { pendingReview: true } })
    ctx.body = { data: results, meta: { total, page, pageSize: limit } }
  },

  async reviewEvent(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const { action } = ctx.request.body as { action: "approve" | "discard" }
    if (action === "approve") {
      await strapi
        .documents("plugin::events.event")
        .update({ documentId, data: { pendingReview: false } })
      ctx.body = { ok: true }
    } else if (action === "discard") {
      await strapi.documents("plugin::events.event").delete({ documentId })
      ctx.status = 204
    } else {
      ctx.status = 400
      ctx.body = { error: "action must be 'approve' or 'discard'" }
    }
  },
})
