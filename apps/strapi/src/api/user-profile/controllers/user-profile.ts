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

/**
 * Fields no custom action may ever spread into a response, regardless of
 * requester. `private: true` on the schema only protects the core
 * find/findOne actions' own sanitizer — every hand-built `ctx.send` here
 * bypasses that, so this list is the single place a new private field
 * must be added to stay out of `findByUsername`/`findByDocumentId` (and
 * anything else built the same way).
 */
const PRIVATE_PROFILE_FIELDS = [
  "baUserId",
  "notifPrefs",
  "contributorNumber",
  "earnedProUntil",
] as const

/** Strip every field in `PRIVATE_PROFILE_FIELDS` from a profile-shaped object. */
function publicProfile<T extends Record<string, any>>(
  profile: T
): Omit<T, (typeof PRIVATE_PROFILE_FIELDS)[number]> {
  const out = { ...profile }
  for (const field of PRIVATE_PROFILE_FIELDS) delete out[field]

  return out
}

const AFFILIATION = "api::library-affiliation.library-affiliation"

/**
 * Who is asking, as far as the bridge secret vouches for it. The owner and
 * viewer ids are only trusted alongside the secret, which only the UI
 * server holds.
 */
function requestIdentity(
  ctx: any,
  profileBaUserId: string | null | undefined
): { isOwnerRequest: boolean; viewerBaUserId: string | null } {
  const secretMatch = isValidServiceSecret(
    ctx.request.headers["x-service-secret"]
  )
  const { ownerBaUserId, viewerBaUserId } = (ctx.query ?? {}) as Record<
    string,
    unknown
  >

  return {
    // ownerBaUserId: the owner viewing their own private/limited profile
    isOwnerRequest:
      secretMatch &&
      typeof ownerBaUserId === "string" &&
      !!ownerBaUserId &&
      ownerBaUserId === profileBaUserId,
    // viewerBaUserId: a signed-in user viewing a limited profile
    viewerBaUserId:
      secretMatch && typeof viewerBaUserId === "string" && viewerBaUserId
        ? viewerBaUserId
        : null,
  }
}

/**
 * The limited-profile rule: a viewer who shares a library affiliation with
 * the owner sees a limited profile in full. `ownerAffiliations` must have
 * `library` populated.
 */
async function viewerSharesLibrary(
  ownerAffiliations: any[],
  viewerBaUserId: string | null
): Promise<boolean> {
  if (!viewerBaUserId) return false
  const ownerLibraryIds = ownerAffiliations
    .map((a: any) => a.library?.id)
    .filter(Boolean)
  if (ownerLibraryIds.length === 0) return false
  const viewerAffiliations = await strapi.db.query(AFFILIATION).findMany({
    where: {
      baUserId: viewerBaUserId,
      library: { id: { $in: ownerLibraryIds } },
    },
  })

  return (viewerAffiliations as any[]).length > 0
}

/** Only the owner or an affiliated viewer may see a limited profile's extras. */
async function canSeeLimitedProfile(
  ctx: any,
  profileBaUserId: string | null | undefined
): Promise<boolean> {
  const { isOwnerRequest, viewerBaUserId } = requestIdentity(
    ctx,
    profileBaUserId
  )
  if (isOwnerRequest) return true
  if (!profileBaUserId || !viewerBaUserId) return false
  const ownerAffiliations = await strapi.db.query(AFFILIATION).findMany({
    where: { baUserId: profileBaUserId },
    populate: { library: true },
  })

  return viewerSharesLibrary(ownerAffiliations as any[], viewerBaUserId)
}

const BADGE_AWARD = "plugin::rewards.badge-award"

type EarnedBadge = { badgeId: string; awardedAt: string }

/** A profile holder's earned badges, in the shape every endpoint returns. */
async function loadEarnedBadges(
  baUserId: string | null | undefined
): Promise<EarnedBadge[]> {
  if (!baUserId) return []
  const awards = await strapi.db
    .query(BADGE_AWARD)
    .findMany({ where: { baUserId } })

  return (awards as any[]).map((a: any) => ({
    badgeId: a.badgeId,
    awardedAt: a.awardedAt,
  }))
}

/**
 * The badge endpoints' gate. Badges follow the activity rule: a private
 * profile's are for its owner (where the endpoint allows an owner bypass at
 * all), and a limited profile's for the owner or an affiliated viewer.
 */
async function mayShowBadges(
  ctx: any,
  profile: { baUserId?: string | null; profileVisibility?: string | null },
  { ownerSeesPrivate }: { ownerSeesPrivate: boolean }
): Promise<boolean> {
  if (profile.profileVisibility === "private")
    return (
      ownerSeesPrivate && requestIdentity(ctx, profile.baUserId).isOwnerRequest
    )
  if (profile.profileVisibility === "limited")
    return canSeeLimitedProfile(ctx, profile.baUserId)

  return true
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
      const { isOwnerRequest, viewerBaUserId } = requestIdentity(
        ctx,
        profile.baUserId
      )

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
      // (The affiliations are already loaded, so this uses the membership
      // check directly rather than canSeeLimitedProfile, which would re-read them.)
      const viewerIsLibraryMember =
        profile.profileVisibility === "limited" && !isOwnerRequest
          ? await viewerSharesLibrary(affiliations as any[], viewerBaUserId)
          : false
      const limitedForViewer =
        profile.profileVisibility === "limited" &&
        !isOwnerRequest &&
        !viewerIsLibraryMember

      // Badges follow the activity rule: a limited profile's are for the
      // owner and fellow library members only.
      const earnedBadges = limitedForViewer
        ? []
        : await loadEarnedBadges(profile.baUserId)

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
      const safe = publicProfile({
        ...profile,
        followedLibraries,
        followedProfiles,
      } as any)

      // Limited profiles hide contact/location details unless the requester is the
      // owner or a fellow library member
      if (limitedForViewer) {
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

      // This endpoint has no owner or viewer bypass, so a limited profile
      // never shows its badges here (they follow the activity rule).
      const earnedBadges =
        profile.profileVisibility === "limited"
          ? []
          : await loadEarnedBadges(profile.baUserId)

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

      const safe = publicProfile({ ...profile, followedLibraries } as any)

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

      // No owner bypass for a private profile on this endpoint.
      if (
        !profile ||
        !(await mayShowBadges(ctx, profile, { ownerSeesPrivate: false }))
      ) {
        return ctx.notFound("Profile not found")
      }

      return ctx.send({ data: await loadEarnedBadges(profile.baUserId) })
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
      if (
        !profile ||
        !(await mayShowBadges(ctx, profile, { ownerSeesPrivate: true }))
      ) {
        return ctx.notFound("Profile not found")
      }

      return ctx.send({ data: await loadEarnedBadges(profile.baUserId) })
    },
  })
)
