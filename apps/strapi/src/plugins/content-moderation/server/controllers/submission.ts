export default ({ strapi }: { strapi: any }) => ({
  // GET /content-moderation/submissions?status=pending  (admin route)
  async findAll(ctx: any) {
    // auth handled by admin::isAuthenticatedAdmin policy on the route
    const { status } = ctx.query as { status?: string }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findAll(status)
    ctx.body = { data: submissions }
  },

  // POST /api/content-moderation/submissions  (content-api route)
  async create(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }
    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
      verificationMethod,
      editSummary,
      evidenceType,
      evidenceUrl,
      asDraft,
    } = ctx.request.body as Record<string, unknown>

    if (!submissionType) {
      return ctx.badRequest("submissionType is required")
    }

    const submission = await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType,
        targetEntityType,
        targetDocumentId,
        targetSlug,
        fields,
        note,
        verificationMethod,
        editSummary,
        evidenceType,
        evidenceUrl,
        submittedByUserId: user.id,
        submittedByEmail: user.email,
        submittedByName: user.name,
        asDraft: !!asDraft,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/my  (content-api route)
  async findMine(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(user.id)
    ctx.body = { data: submissions }
  },

  // PUT  /content-moderation/submissions/:id/status   (admin route only)
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    const { status, reviewNote } = ctx.request.body as {
      status: string
      reviewNote?: string
    }

    const VALID_STATUSES = ["approved", "rejected", "needs_info", "pending"]
    if (!VALID_STATUSES.includes(status)) {
      return ctx.badRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      )
    }

    const reviewerId = String(
      ctx.state.admin?.id ?? ctx.state.user?.id ?? "unknown"
    )

    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, reviewerId, reviewNote)

    ctx.body = { data: updated }
  },

  // PATCH /api/content-moderation/submissions/:id/finalize  (content-api route)
  // Promotes a draft submission to "pending" — makes it visible to the moderation queue.
  async finalize(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    let body: Record<string, unknown>
    try {
      body = (await ctx.request.body) as Record<string, unknown>
    } catch {
      return ctx.badRequest("Invalid request body")
    }
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .finalizeDraft(id, user.id, body)
    if (!result) return ctx.notFound("Draft not found or already finalized.")
    ctx.body = { data: result }
  },

  // PATCH /api/content-moderation/submissions/:id/draft  (content-api route)
  async saveDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    const { draftData, stepCompleted } = ctx.request.body as {
      draftData: Record<string, unknown>
      stepCompleted: number
    }
    // Verify the draft belongs to the requesting user
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId: id })
    if (!existing) return ctx.notFound()
    if (existing.submittedByUserId !== user.id) {
      return ctx.forbidden("You do not own this submission.")
    }
    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .saveDraft(id, draftData, stepCompleted ?? 0)
    ctx.body = { data: updated }
  },

  // GET /api/content-moderation/submissions/draft/:type  (content-api route)
  async findDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { type } = ctx.params as { type: string }
    const { targetSlug } = ctx.query as { targetSlug?: string }
    const draft = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findDraft(user.id, type, targetSlug)
    ctx.body = { data: draft }
  },
})

// Resolves the calling user from the request.
// Accepts two auth patterns:
//   1. Service-to-service: X-Service-Secret header (from Next.js API routes) +
//      X-Ba-User-Id / X-Ba-User-Email / X-Ba-User-Name headers carrying identity
//   2. Better Auth session cookie (requires strapi-better-auth plugin)
//   3. Strapi users-permissions JWT in Authorization: Bearer header (fallback)
async function resolveUser(
  strapi: any,
  ctx: any
): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    // Pattern 1: service-to-service via X-Service-Secret
    const incoming = ctx.request.headers["x-service-secret"]
    const bridgeSecret = process.env.STRAPI_BRIDGE_SECRET
    if (incoming && bridgeSecret && incoming === bridgeSecret) {
      const userId = ctx.request.headers["x-ba-user-id"] as string | undefined
      const userEmail = ctx.request.headers["x-ba-user-email"] as
        | string
        | undefined
      const userName = (ctx.request.headers["x-ba-user-name"] as string) ?? ""
      if (userId && userEmail) {
        return { id: userId, email: userEmail, name: userName }
      }
    }

    // Pattern 2: strapi-better-auth plugin (when installed)
    if (strapi.betterAuth?.api?.getSession) {
      const session = await strapi.betterAuth.api.getSession({
        headers: ctx.request.headers,
      })

      return session?.user ?? null
    }

    // Pattern 3: Strapi users-permissions JWT
    if (ctx.state.user) {
      return {
        id: String(ctx.state.user.id),
        email: ctx.state.user.email,
        name: ctx.state.user.username,
      }
    }

    return null
  } catch {
    return null
  }
}
