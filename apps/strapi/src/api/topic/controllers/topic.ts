import { factories } from "@strapi/strapi"

import { readLocale } from "../../../utils/read-status"
import { requireTopicModerator } from "../../../utils/topic-authority"

export default factories.createCoreController(
  "api::topic.topic" as any,
  () => ({
    // GET /api/topics/approved — public
    async findApproved(ctx: any) {
      const topics = await strapi
        .service("api::topic.topic")
        .findApproved(readLocale(ctx))
      ctx.body = { data: topics }
    },

    // GET /api/topics — admin only
    async findAll(ctx: any) {
      if (!(await requireTopicModerator(strapi, ctx))) return
      const topics = await strapi
        .service("api::topic.topic")
        .findAll(readLocale(ctx))
      ctx.body = { data: topics }
    },

    // PATCH /api/topics/:id/status — admin
    async updateStatus(ctx: any) {
      if (!(await requireTopicModerator(strapi, ctx))) return
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(ctx.params?.id ?? "") ||
        !["approved", "pending", "rejected"].includes(ctx.request.body?.status)
      ) {
        return ctx.badRequest("Invalid topic status request")
      }
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
