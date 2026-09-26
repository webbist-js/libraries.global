import { factories } from "@strapi/strapi"

import { isValidServiceSecret } from "../../../utils/service-secret"

/** Atlas URL for a library (/continent/country/region/slug), or null if any segment is missing. */
function buildLibraryPath(library: any): string | null {
  const segments = [
    library.continent?.slug,
    library.country?.slug,
    library.region?.slug,
    library.slug,
  ]

  return segments.every(Boolean) ? `/${segments.join("/")}` : null
}

type PublicPrefs = {
  showLocation: boolean
  showAffiliation: boolean
  showActivity: boolean
  showFollows: boolean
}

const DEFAULT_PUBLIC_PREFS: PublicPrefs = {
  showLocation: true,
  showAffiliation: true,
  showActivity: true,
  showFollows: true,
}

function resolvePublicPrefs(raw: unknown): PublicPrefs {
  const prefs = { ...DEFAULT_PUBLIC_PREFS }
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(
      DEFAULT_PUBLIC_PREFS
    ) as (keyof PublicPrefs)[]) {
      const value = (raw as Record<string, unknown>)[key]
      if (typeof value === "boolean") prefs[key] = value
    }
  }

  return prefs
}

/**
 * Enforce the owner's public-visibility toggles server-side. The UI also hides
 * these, but this endpoint is unauthenticated, so the data must never leave
 * Strapi when the owner has switched it off. The owner themselves (via the
 * bridge-secret owner bypass) always gets the full record.
 */
function applyPublicPrefs(
  data: Record<string, any>,
  isOwnerRequest: boolean
): Record<string, any> {
  if (isOwnerRequest) return data
  const prefs = resolvePublicPrefs(data.publicPrefs)
  const out = { ...data }
  if (!prefs.showLocation) {
    out.city = null
    out.country = null
    out.timezone = null
  }
  if (!prefs.showAffiliation) {
    out.affiliation = null
    out.affiliationType = null
    out.jobTitle = null
    out.claimedLibraries = []
  }
  if (!prefs.showFollows) {
    out.followedLibraries = []
    out.followedProfiles = []
  }

  return out
}

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
            followedLibraries: {
              populate: {
                heroImage: true,
                continent: true,
                country: true,
                region: true,
              },
            },
          },
          limit: 1,
        })
      const profile = results[0] ?? null
      if (!profile) return ctx.notFound("Profile not found")

      // Server-to-server owner/viewer bypass — both require the bridge secret
      const secretMatch = isValidServiceSecret(
        ctx.request.headers["x-service-secret"]
      )

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
        return ctx.forbidden("Profile is private")
      }

      // Fetch claimed library affiliations for this profile
      const affiliations = profile.baUserId
        ? await strapi.db
            .query("api::library-affiliation.library-affiliation")
            .findMany({
              where: { baUserId: profile.baUserId },
              populate: {
                library: {
                  populate: { continent: true, country: true, region: true },
                },
              },
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
          path: buildLibraryPath(a.library),
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
              followedLibraries: {
                populate: {
                  heroImage: true,
                  continent: true,
                  country: true,
                  region: true,
                },
              },
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
        path: buildLibraryPath(lib),
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
          data: applyPublicPrefs(
            { ...limited, claimedLibraries, earnedBadges },
            isOwnerRequest
          ),
        })
      }

      return ctx.send({
        data: applyPublicPrefs(
          { ...safe, claimedLibraries, earnedBadges },
          isOwnerRequest
        ),
      })
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
            followedLibraries: {
              populate: {
                heroImage: true,
                continent: true,
                country: true,
                region: true,
              },
            },
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
              populate: {
                library: {
                  populate: { continent: true, country: true, region: true },
                },
              },
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
          path: buildLibraryPath(a.library),
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
              followedLibraries: {
                populate: {
                  heroImage: true,
                  continent: true,
                  country: true,
                  region: true,
                },
              },
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
        path: buildLibraryPath(lib),
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
          data: applyPublicPrefs(
            { ...limited, claimedLibraries, earnedBadges },
            false
          ),
        })
      }

      return ctx.send({
        data: applyPublicPrefs(
          { ...safe, claimedLibraries, earnedBadges },
          false
        ),
      })
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

      const ownerBaUserId2 = (ctx.query as any)?.ownerBaUserId as
        | string
        | undefined
      const isOwnerRequest2 =
        isValidServiceSecret(ctx.request.headers["x-service-secret"]) &&
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
