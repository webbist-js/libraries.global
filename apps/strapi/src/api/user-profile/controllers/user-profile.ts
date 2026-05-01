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
            followedLibraries: { populate: { heroImage: true } },
          },
        })
      if (!profile) return ctx.notFound("Profile not found")

      // Private profiles are not publicly visible
      if (profile.profileVisibility === "private") {
        return ctx.notFound("Profile not found")
      }

      // Fetch claimed library affiliations for this profile
      const affiliations = profile.baUserId
        ? await strapi.db
            .query("api::library-affiliation.library-affiliation")
            .findMany({
              where: { baUserId: profile.baUserId },
              populate: { library: true },
            })
        : []

      const claimedLibraries = (affiliations as any[])
        .filter((a: any) => a.library)
        .map((a: any) => ({
          entityRef: a.library.entityRef ?? null,
          documentId: a.library.documentId ?? null,
          name: a.library.name ?? null,
          slug: a.library.slug ?? null,
          libraryType: a.library.libraryType ?? null,
        }))

      // Fetch earned badges for this profile
      const badgeAwards = profile.baUserId
        ? await strapi.db
            .query("plugin::rewards.badge-award")
            .findMany({ where: { baUserId: profile.baUserId } })
        : []

      const earnedBadges = (badgeAwards as any[]).map((a: any) => ({
        badgeId: a.badgeId,
        awardedAt: a.awardedAt,
      }))

      // Normalise followedLibraries so heroImageUrl is a plain string
      const followedLibraries = (
        (profile.followedLibraries ?? []) as any[]
      ).map((lib: any) => ({
        id: lib.id,
        documentId: lib.documentId ?? null,
        name: lib.name ?? null,
        slug: lib.slug ?? null,
        libraryType: lib.libraryType ?? null,
        heroImageUrl: lib.heroImage?.url ?? null,
      }))

      // Fields always stripped from public responses
      const {
        baUserId: _baUserId,
        notifPrefs: _notifPrefs,
        contributorNumber: _contribNum,
        ...safe
      } = { ...profile, followedLibraries } as any

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

        return ctx.send({
          data: { ...limited, claimedLibraries, earnedBadges },
        })
      }

      return ctx.send({ data: { ...safe, claimedLibraries, earnedBadges } })
    },

    async findBadgesByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const profile = await strapi
        .query("api::user-profile.user-profile")
        .findOne({
          where: { username },
          select: ["baUserId", "profileVisibility"],
        })

      if (!profile || profile.profileVisibility === "private") {
        return ctx.notFound("Profile not found")
      }
      if (!profile.baUserId) return ctx.send({ data: [] })

      const awards = await strapi.db
        .query("plugin::rewards.badge-award")
        .findMany({ where: { baUserId: profile.baUserId } })

      const data = (awards as any[]).map((a: any) => ({
        badgeId: a.badgeId,
        awardedAt: a.awardedAt,
      }))

      return ctx.send({ data })
    },
  })
)
