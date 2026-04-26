export default ({ strapi }: { strapi: any }) => ({
  // GET /api/content-moderation/submissions?status=pending
  async findAll(ctx: any) {
    const { status } = ctx.query as { status?: string }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findAll(status)
    ctx.body = { data: submissions }
  },

  // POST /api/content-moderation/submissions
  async create(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }
    const { user } = session
    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
      verificationMethod,
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
        submittedByUserId: user.id,
        submittedByEmail: user.email,
        submittedByName: user.name,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/my
  async findMine(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const { user } = session

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(user.id)

    ctx.body = { data: submissions }
  },

  // PATCH /api/content-moderation/submissions/:id/status
  async updateStatus(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const { user } = session
    const { id } = ctx.params
    const { status, reviewNote } = ctx.request.body as {
      status: string
      reviewNote?: string
    }

    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, user.id, reviewNote)

    ctx.body = { data: updated }
  },
})
