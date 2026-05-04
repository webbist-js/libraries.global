import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::saved-event.saved-event",
  ({ strapi }) => ({
    // GET /api/saved-events — list current user's saved events
    async find(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const results = await strapi
        .documents("api::saved-event.saved-event")
        .findMany({
          filters: { user: userId } as never,
        })

      ctx.body = results
    },

    // POST /api/saved-events { eventDocumentId } — save an event
    async create(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const { eventDocumentId } = ctx.request.body as {
        eventDocumentId: string
      }
      if (!eventDocumentId) return ctx.badRequest("eventDocumentId required")

      // Idempotent: return existing if already saved
      const existing = await strapi
        .documents("api::saved-event.saved-event")
        .findFirst({
          filters: { user: userId, eventDocumentId } as never,
        })
      if (existing) {
        ctx.body = existing

        return
      }

      const created = await strapi
        .documents("api::saved-event.saved-event")
        .create({
          data: { eventDocumentId, user: userId },
        })
      ctx.status = 201
      ctx.body = created
    },

    // DELETE /api/saved-events/:documentId — unsave
    async delete(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const { id: documentId } = ctx.params as { id: string }

      const record = await strapi
        .documents("api::saved-event.saved-event")
        .findOne({ documentId })

      if (!record) return ctx.notFound()
      if ((record as { user?: { id: number } }).user?.id !== userId)
        return ctx.forbidden()

      await strapi
        .documents("api::saved-event.saved-event")
        .delete({ documentId })

      ctx.status = 204
    },
  })
)
