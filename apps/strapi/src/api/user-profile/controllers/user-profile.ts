import { factories } from "@strapi/strapi"

const base = factories.createCoreController("api::user-profile.user-profile")

export default {
  ...base,
  async findByUsername(ctx: any) {
    const { username } = ctx.params as { username: string }
    const profile = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { username } })
    if (!profile) return ctx.notFound("Profile not found")
    // Strip internal fields
    const { baUserId, ...safe } = profile
    return ctx.send({ data: safe })
  },
}
