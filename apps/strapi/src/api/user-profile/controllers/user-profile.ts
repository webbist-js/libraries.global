import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::user-profile.user-profile",
  () => ({
    async findByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const results = await strapi
        .documents("api::user-profile.user-profile")
        .findMany({
          filters: { username: { $eq: username } } as any,
          populate: {
            avatar: true,
            languages: true,
            followedLibraries: { populate: { heroImage: true } },
          },
          limit: 1,
        })
      const profile = results[0] ?? null
      if (!profile) return ctx.notFound("Profile not found")

      // Server-to-server owner/viewer bypass — both require the bridge secret
      const bridgeSecret = process.env.STRAPI_BRIDGE_SECRET
      const secretMatch =
        !!bridgeSecret &&
        String(ctx.request.headers["x-service-secret"] ?? "") === bridgeSecret

      // ownerBaUserId: profile owner viewing their own private/limited profile
      const ownerBaUserId = (ctx.query as any)?.ownerBaUserId as
        | string
        | undefined
      const isOwnerRequest =
        secretMatch && !!ownerBaUserId && ownerBaUserId === profile.baUserId

      // viewerBaUserId: logged-in user viewing a limited profile (membership check)
      const viewerBaUserId = (ctx.query as any)?.viewerBaUserId as
        | string
        | undefined
      const hasViewerIdentity = secretMatch && !!viewerBaUserId

      // Private profiles are not publicly visible (unless the owner is requesting)
      if (profile.profileVisibility === "private" && !isOwnerRequest) {
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

      // For limited profiles, check whether the viewer is affiliated with any of
      // the same libraries as the profile owner — if so, they see the full profile
      let viewerIsLibraryMember = false
      if (
        profile.profileVisibility === "limited" &&
        !isOwnerRequest &&
        hasViewerIdentity &&
        affiliations.length > 0
      ) {
        const ownerLibraryIds = (affiliations as any[])
          .map((a: any) => a.library?.id)
          .filter(Boolean)
        if (ownerLibraryIds.length > 0) {
          const viewerAffiliations = await strapi.db
            .query("api::library-affiliation.library-affiliation")
            .findMany({
              where: {
                baUserId: viewerBaUserId,
                library: { id: { $in: ownerLibraryIds } },
              },
            })
          viewerIsLibraryMember = (viewerAffiliations as any[]).length > 0
        }
      }

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

      // followedLibraries + followedProfiles are written via db.query
      // connect/disconnect; re-fetch via db.query so we see the same data.
      // Document Service populate does not reliably reflect db.query relation writes.
      const profileWithFollows = profile.baUserId
        ? await strapi.db.query("api::user-profile.user-profile").findOne({
            where: { baUserId: profile.baUserId },
            populate: {
              followedLibraries: { populate: { heroImage: true } },
              followedProfiles: { populate: { avatar: true } },
            },
          })
        : null
      const followedLibraries = (
        (profileWithFollows?.followedLibraries ?? []) as any[]
      ).map((lib: any) => ({
        id: lib.id,
        documentId: lib.documentId ?? null,
        name: lib.name ?? null,
        slug: lib.slug ?? null,
        libraryType: lib.libraryType ?? null,
        heroImageUrl: lib.heroImage?.url ?? null,
      }))
      // Only surface public followed profiles — never expose private/limited ones
      const followedProfiles = (
        (profileWithFollows?.followedProfiles ?? []) as any[]
      )
        .filter((p: any) => p.profileVisibility === "public")
        .map((p: any) => ({
          username: p.username ?? null,
          displayName:
            [p.firstName, p.lastName].filter(Boolean).join(" ") ||
            p.username ||
            null,
          avatarUrl: p.avatar?.url ?? null,
          bio: p.bio ?? null,
        }))

      // Fields always stripped from public responses
      const {
        baUserId: _baUserId,
        notifPrefs: _notifPrefs,
        contributorNumber: _contribNum,
        ...safe
      } = { ...profile, followedLibraries, followedProfiles } as any

      // Limited profiles hide contact/location details unless the requester is the
      // owner or a fellow library member
      if (
        profile.profileVisibility === "limited" &&
        !isOwnerRequest &&
        !viewerIsLibraryMember
      ) {
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

    async findByDocumentId(ctx: any) {
      const { documentId } = ctx.params as { documentId: string }
      const profile = await strapi
        .documents("api::user-profile.user-profile")
        .findOne({
          documentId,
          populate: {
            avatar: true,
            languages: true,
            followedLibraries: { populate: { heroImage: true } },
          },
        })
      if (!profile) return ctx.notFound("Profile not found")

      if (profile.profileVisibility === "private") {
        return ctx.notFound("Profile not found")
      }

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

      const badgeAwards = profile.baUserId
        ? await strapi.db
            .query("plugin::rewards.badge-award")
            .findMany({ where: { baUserId: profile.baUserId } })
        : []

      const earnedBadges = (badgeAwards as any[]).map((a: any) => ({
        badgeId: a.badgeId,
        awardedAt: a.awardedAt,
      }))

      const profileWithFollows2 = profile.baUserId
        ? await strapi.db.query("api::user-profile.user-profile").findOne({
            where: { baUserId: profile.baUserId },
            populate: {
              followedLibraries: { populate: { heroImage: true } },
            },
          })
        : null
      const followedLibraries = (
        (profileWithFollows2?.followedLibraries ?? []) as any[]
      ).map((lib: any) => ({
        id: lib.id,
        documentId: lib.documentId ?? null,
        name: lib.name ?? null,
        slug: lib.slug ?? null,
        libraryType: lib.libraryType ?? null,
        heroImageUrl: lib.heroImage?.url ?? null,
      }))

      const {
        baUserId: _baUserId,
        notifPrefs: _notifPrefs,
        contributorNumber: _contribNum,
        ...safe
      } = { ...profile, followedLibraries } as any

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

    async findBadgesByDocumentId(ctx: any) {
      const { documentId } = ctx.params as { documentId: string }
      const profile = await strapi
        .documents("api::user-profile.user-profile")
        .findOne({
          documentId,
          fields: ["baUserId", "profileVisibility"] as any,
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

    async findBadgesByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const results = await strapi
        .documents("api::user-profile.user-profile")
        .findMany({
          filters: { username: { $eq: username } } as any,
          fields: ["baUserId", "profileVisibility"] as any,
          limit: 1,
        })
      const profile = results[0] ?? null

      const bridgeSecret2 = process.env.STRAPI_BRIDGE_SECRET
      const ownerBaUserId2 = (ctx.query as any)?.ownerBaUserId as
        | string
        | undefined
      const isOwnerRequest2 =
        !!bridgeSecret2 &&
        String(ctx.request.headers["x-service-secret"] ?? "") ===
          bridgeSecret2 &&
        !!ownerBaUserId2 &&
        ownerBaUserId2 === profile?.baUserId

      if (
        !profile ||
        (profile.profileVisibility === "private" && !isOwnerRequest2)
      ) {
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
