export default ({ strapi }: { strapi: any }) => ({
  async listCredentials(ctx: any) {
    const items = await strapi.plugin("events").service("credentials").findAll()
    // Mask encrypted blob from response
    ctx.body = (items as any[]).map((c: any) => ({
      ...c,
      credentialsEncrypted: undefined,
    }))
  },

  async createCredential(ctx: any) {
    const { credentials, ...rest } = ctx.request.body as {
      credentials: Record<string, string>
      provider: string
      label: string
      scope: string
      isActive: boolean
      libraryDocumentIds?: string[]
    }
    const result = await strapi
      .plugin("events")
      .service("credentials")
      .create({ ...rest, credentials })
    ctx.body = { ...result, credentialsEncrypted: undefined }
  },

  async updateCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const { credentials, ...rest } = ctx.request.body as {
      credentials?: Record<string, string>
      label?: string
      isActive?: boolean
      libraryDocumentIds?: string[]
    }
    const result = await strapi
      .plugin("events")
      .service("credentials")
      .update(documentId, { ...rest, credentials })
    ctx.body = { ...result, credentialsEncrypted: undefined }
  },

  async deleteCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    await strapi.plugin("events").service("credentials").delete(documentId)
    ctx.status = 204
  },

  async testCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/test-credential`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Secret": process.env.WORKER_SECRET ?? "",
        },
        body: JSON.stringify({ credentialDocumentId: documentId }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        ctx.body = { ok: false, error: `Worker returned ${res.status}` }

        return
      }
      ctx.body = await res.json()
    } catch (err: any) {
      ctx.body = { ok: false, error: err.message ?? "Worker unreachable" }
    }
  },

  async testRaw(ctx: any) {
    const { provider, credentials } = ctx.request.body as {
      provider: string
      credentials: Record<string, string>
    }
    if (!provider || !credentials) {
      ctx.status = 400
      ctx.body = { ok: false, error: "provider and credentials are required" }

      return
    }
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/test-credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, credentials }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        ctx.body = { ok: false, error: `Worker returned ${res.status}` }

        return
      }
      ctx.body = await res.json()
    } catch (err: any) {
      ctx.body = { ok: false, error: err.message ?? "Worker unreachable" }
    }
  },

  async listRuns(ctx: any) {
    const { limit = "20", page = "1" } = ctx.query as Record<string, string>
    const results = await strapi
      .documents("plugin::events.import-run")
      .findMany({
        sort: ["startedAt:desc"],
        pagination: { page: Number(page), pageSize: Number(limit) },
      })
    ctx.body = results
  },

  async getRun(ctx: any) {
    const { runId } = ctx.params as { runId: string }
    const run = await strapi.documents("plugin::events.import-run").findMany({
      filters: { runId },
      pagination: { pageSize: 1 },
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
    const { limit = "20", page = "1" } = ctx.query as Record<string, string>
    const results = await strapi.documents("plugin::events.event").findMany({
      filters: { pendingReview: true },
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "startTime",
        "libraryEntityRef",
        "sourceProvider",
        "url",
      ],
    })
    ctx.body = results
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
