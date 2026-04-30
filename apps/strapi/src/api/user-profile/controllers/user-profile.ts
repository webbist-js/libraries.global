import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::user-profile.user-profile",
  () => ({
    async findByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const profile = await strapi
        .query("api::user-profile.user-profile")
        .findOne({
          where: { username },
          populate: {
            avatar: true,
            languages: true,
            followedLibraries: true,
          },
        })
      if (!profile) return ctx.notFound("Profile not found")

      // Private profiles are not publicly visible
      if (profile.profileVisibility === "private") {
        return ctx.notFound("Profile not found")
      }

      // Fields always stripped from public responses
      const {
        baUserId: _baUserId,
        notifPrefs: _notifPrefs,
        contributorNumber: _contribNum,
        ...safe
      } = profile

      // Limited profiles also hide contact/location details
      if (profile.profileVisibility === "limited") {
        const {
          website,
          orcid,
          mastodon,
          linkedin,
          city,
          country,
          timezone,
          ...limited
        } = safe

        return ctx.send({ data: limited })
      }

      return ctx.send({ data: safe })
    },
  })
)
