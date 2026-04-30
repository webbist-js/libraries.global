import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::topic.topic" as any,
  () => ({
    // GET /api/topics/approved — public
    async findApproved(ctx: any) {
      const topics = await strapi.service("api::topic.topic").findApproved()
      ctx.body = { data: topics }
    },

    // GET /api/topics — admin only
    async findAll(ctx: any) {
      const topics = await strapi.service("api::topic.topic").findAll()
      ctx.body = { data: topics }
    },

    // PATCH /api/topics/:id/status — admin
    async updateStatus(ctx: any) {
      const { id } = ctx.params as { id: string }
      const { status } = ctx.request.body as {
        status: "approved" | "pending" | "rejected"
      }
      const topic = await strapi
        .service("api::topic.topic")
        .updateStatus(id, status)
      ctx.body = { data: topic }
    },
  })
)
