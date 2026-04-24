export default ({ strapi }: { strapi: any }) => ({
  // POST /api/content-moderation/submissions
  async create(ctx: any) {
    const user = ctx.state?.user
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
        submittedByUserId: String(user.id),
        submittedByEmail: user.email,
        submittedByName: user.username ?? user.email,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/my
  async findMine(ctx: any) {
    const user = ctx.state?.user
    if (!user) {
      return ctx.unauthorized("You must be signed in.")
    }

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(String(user.id))

    ctx.body = { data: submissions }
  },

  // PATCH /api/content-moderation/submissions/:id/status  (admin only)
  async updateStatus(ctx: any) {
    const user = ctx.state?.user
    if (
      !user?.roles?.some(
        (r: any) =>
          r.code === "strapi-editor" || r.code === "strapi-super-admin"
      )
    ) {
      return ctx.forbidden("Moderator access required.")
    }

    const { id } = ctx.params
    const { status, reviewNote } = ctx.request.body as {
      status: string
      reviewNote?: string
    }

    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, String(user.id), reviewNote)

    ctx.body = { data: updated }
  },
})
