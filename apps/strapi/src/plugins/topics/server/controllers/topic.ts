export default ({ strapi }: { strapi: any }) => ({
  // GET /api/topics/approved — public
  async findApproved(ctx: any) {
    const topics = await strapi.plugin("topics").service("topic").findApproved()
    ctx.body = { data: topics }
  },

  // GET /api/topics — admin only (no auth check here; rely on route config)
  async findAll(ctx: any) {
    const topics = await strapi.plugin("topics").service("topic").findAll()
    ctx.body = { data: topics }
  },

  // PATCH /api/topics/:id/status — admin
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    const { status } = ctx.request.body as { status: string }
    const topic = await strapi
      .plugin("topics")
      .service("topic")
      .updateStatus(id, status)
    ctx.body = { data: topic }
  },
})
