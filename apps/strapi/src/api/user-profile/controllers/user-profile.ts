import { isSupporterPlan } from "@repo/access"
import { factories } from "@strapi/strapi"

import { resolveUserEntitlements } from "../../../utils/entitlement-inputs"
import { isValidServiceSecret } from "../../../utils/service-secret"
import { supporterMark } from "../../../utils/supporters"

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

/** The activity block: points, streak, tier, badges and when they last did something. */
const ACTIVITY_FIELDS = [
  "points",
  "pointsThisMonth",
  "streak",
  "tier",
  "lastActivityDate",
] as const

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
    out.followedDrives = []
    out.followedProfiles = []
  }
  if (!prefs.showActivity) {
    for (const field of ACTIVITY_FIELDS) out[field] = null
    out.earnedBadges = []
  }

  return out
}

/** True when the owner has switched their activity (and so their badges) off. */
const activityHidden = (profile: { publicPrefs?: unknown }) =>
  !resolvePublicPrefs(profile.publicPrefs).showActivity

/** Only published libraries, in the shape every profile endpoint returns. */
function publishedFollowedLibraries(rows: unknown): Record<string, unknown>[] {
  return ((rows ?? []) as any[])
    .filter((lib: any) => lib?.publishedAt)
    .map((lib: any) => ({
      id: lib.id,
      documentId: lib.documentId ?? null,
      name: lib.name ?? null,
      slug: lib.slug ?? null,
      libraryType: lib.libraryType ?? null,
      heroImageUrl: lib.heroImage?.url ?? null,
      path: buildLibraryPath(lib),
    }))
}

/** At most this many followed drives come back with a profile. */
const MAX_FOLLOWED_DRIVES = 100

/**
 * Followed drives as `{ documentId, slug }`, once each: a drive has one row
 * per locale, and a draft drive (lifecycle `status`) never surfaces.
 */
function publicFollowedDrives(
  rows: unknown
): { documentId: string; slug: string }[] {
  const seen = new Set<string>()
  const out: { documentId: string; slug: string }[] = []
  for (const row of (rows ?? []) as any[]) {
    const documentId = row?.documentId
    const slug = row?.slug
    if (typeof documentId !== "string" || typeof slug !== "string") continue
    if (row.status === "draft" || seen.has(documentId)) continue
    seen.add(documentId)
    out.push({ documentId, slug })
  }

  return out.slice(0, MAX_FOLLOWED_DRIVES)
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
  "dismissedPrompts",
  "contributorNumber",
  "earnedProUntil",
  "supporterListed",
  "supporterBadgeVisible",
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
const PROFILE = "api::user-profile.user-profile"

/** Incoming follows as a count only, including people with private profiles. */
async function loadFollowerCount(documentId: string): Promise<number> {
  return strapi.db.query(PROFILE).count({
    where: { followedProfiles: { documentId: { $eq: documentId } } },
  })
}

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

/** A profile holder's library affiliations, with each library's Atlas hierarchy. */
async function loadAffiliations(
  baUserId: string | null | undefined
): Promise<any[]> {
  if (!baUserId) return []

  return (await strapi.db.query(AFFILIATION).findMany({
    where: { baUserId },
    populate: {
      library: { populate: { continent: true, country: true, region: true } },
    },
  })) as any[]
}

/** Affiliations as the `claimedLibraries` every profile endpoint returns. */
function toClaimedLibraries(affiliations: any[]): Record<string, unknown>[] {
  return affiliations
    .filter((a: any) => a.library)
    .map((a: any) => ({
      entityRef: a.library.entityRef ?? null,
      documentId: a.library.documentId ?? null,
      name: a.library.name ?? null,
      slug: a.library.slug ?? null,
      libraryType: a.library.libraryType ?? null,
      path: buildLibraryPath(a.library),
    }))
}

/**
 * Followed libraries (published only), followed drives (never a draft) and
 * followed profiles (public only). Follows are written via db.query
 * connect/disconnect, so they are read back the same way: Document Service
 * populate does not reliably reflect those writes. A library unpublished
 * since it was followed must not surface, and private or limited profiles
 * are never listed.
 */
async function loadFollows(baUserId: string | null | undefined): Promise<{
  followedLibraries: Record<string, unknown>[]
  followedDrives: { documentId: string; slug: string }[]
  followedProfiles: Record<string, unknown>[]
}> {
  if (!baUserId)
    return { followedLibraries: [], followedDrives: [], followedProfiles: [] }
  const row = await strapi.db.query(PROFILE).findOne({
    where: { baUserId },
    populate: {
      followedLibraries: {
        where: { publishedAt: { $notNull: true } },
        populate: {
          heroImage: true,
          continent: true,
          country: true,
          region: true,
        },
      },
      followedDrives: {
        where: { status: { $ne: "draft" } },
        select: ["documentId", "slug", "status"],
        orderBy: { id: "asc" },
        limit: MAX_FOLLOWED_DRIVES,
      },
      followedProfiles: { populate: { avatar: true } },
    },
  })

  return {
    followedLibraries: publishedFollowedLibraries(row?.followedLibraries),
    followedDrives: publicFollowedDrives(row?.followedDrives),
    followedProfiles: ((row?.followedProfiles ?? []) as any[])
      .filter((p: any) => p.profileVisibility === "public")
      .map((p: any) => ({
        username: p.username ?? null,
        displayName:
          [p.firstName, p.lastName].filter(Boolean).join(" ") ||
          p.username ||
          null,
        avatarUrl: p.avatar?.url ?? null,
        bio: p.bio ?? null,
      })),
  }
}

/**
 * Fields kept out of the owner's own view (`findMe`). The owner sees their
 * notification settings and contributor number; the Better Auth id is the
 * key the caller already holds, and earnedProUntil is plan bookkeeping that
 * only the session-profile bridge reads.
 */
const OWNER_HIDDEN_FIELDS = ["baUserId", "earnedProUntil"] as const

/**
 * The Better Auth id the bridge vouches for: `X-Ba-User-Id`, trusted only
 * alongside a valid `X-Service-Secret`. Null when either is missing or bad.
 */
function bridgeBaUserId(ctx: any): string | null {
  if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
    return null
  const id = ctx.request.headers["x-ba-user-id"]

  return typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null
}

/**
 * The badge endpoints' gate. Badges follow the activity rule: a private
 * profile's are for its owner (where the endpoint allows an owner bypass at
 * all), a limited profile's for the owner or an affiliated viewer, and a
 * profile whose owner hid their activity (`publicPrefs.showActivity`) shows
 * them to the owner only.
 */
async function mayShowBadges(
  ctx: any,
  profile: {
    baUserId?: string | null
    profileVisibility?: string | null
    publicPrefs?: unknown
  },
  { ownerSeesPrivate }: { ownerSeesPrivate: boolean }
): Promise<boolean> {
  const isOwner = requestIdentity(ctx, profile.baUserId).isOwnerRequest
  if (profile.profileVisibility === "private")
    return ownerSeesPrivate && isOwner
  if (activityHidden(profile)) return ownerSeesPrivate && isOwner
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
      const affiliations = await loadAffiliations(profile.baUserId)
      const claimedLibraries = toClaimedLibraries(affiliations)

      // For limited profiles, check whether the viewer is affiliated with any of
      // the same libraries as the profile owner — if so, they see the full profile
      // (The affiliations are already loaded, so this uses the membership
      // check directly rather than canSeeLimitedProfile, which would re-read them.)
      const viewerIsLibraryMember =
        profile.profileVisibility === "limited" && !isOwnerRequest
          ? await viewerSharesLibrary(affiliations, viewerBaUserId)
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

      // Published libraries, drives past draft and public profiles only
      // (see loadFollows).
      const [follows, followerCount, mark] = await Promise.all([
        loadFollows(profile.baUserId),
        loadFollowerCount(profile.documentId),
        supporterMark(strapi, profile),
      ])

      // Fields always stripped from public responses
      const safe = publicProfile({
        ...profile,
        supporterMark: mark,
        ...follows,
        followerCount,
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

    /**
     * GET /api/user-profiles/me — the signed-in user's own profile, keyed on
     * the Better Auth id. Bridge only: the UI server sends X-Service-Secret
     * and X-Ba-User-Id from the session. Returns the owner view (no
     * visibility rules apply) with the shapes the profile, settings,
     * onboarding, notification and export pages need.
     */
    async findMe(ctx: any) {
      if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
        return ctx.unauthorized("Invalid or missing service secret")
      const baUserId = bridgeBaUserId(ctx)
      if (!baUserId) return ctx.badRequest("Missing X-Ba-User-Id")

      const profile = await strapi.documents(PROFILE).findFirst({
        filters: { baUserId: { $eq: baUserId } },
        populate: { avatar: true, languages: true },
      })
      if (!profile) return ctx.notFound("Profile not found")

      const [affiliations, follows, earnedBadges, entitlements, followerCount] =
        await Promise.all([
          loadAffiliations(baUserId),
          loadFollows(baUserId),
          loadEarnedBadges(baUserId),
          resolveUserEntitlements(strapi, baUserId),
          loadFollowerCount(profile.documentId),
        ])

      const owner: Record<string, unknown> = {
        ...profile,
        ...follows,
        followerCount,
        isSupporter: isSupporterPlan(entitlements.plan),
        supporterMark:
          isSupporterPlan(entitlements.plan) &&
          profile.supporterBadgeVisible !== false,
        claimedLibraries: toClaimedLibraries(affiliations),
        earnedBadges,
      }
      for (const field of OWNER_HIDDEN_FIELDS) delete owner[field]

      return ctx.send({ data: owner })
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
                where: { publishedAt: { $notNull: true } },
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
      const followedLibraries = publishedFollowedLibraries(
        profileWithFollows2?.followedLibraries
      )

      const [mark, followerCount] = await Promise.all([
        supporterMark(strapi, profile),
        loadFollowerCount(profile.documentId),
      ])
      const safe = publicProfile({
        ...profile,
        followedLibraries,
        supporterMark: mark,
        followerCount,
      } as any)

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
          fields: ["baUserId", "profileVisibility", "publicPrefs"] as any,
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
          fields: ["baUserId", "profileVisibility", "publicPrefs"] as any,
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

    /** The Drives ribbons for a profile (spec §8): follows the activity rule. */
    async findDrivesByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const results = await strapi
        .documents("api::user-profile.user-profile")
        .findMany({
          filters: { username: { $eq: username } } as any,
          fields: ["baUserId", "profileVisibility", "publicPrefs"] as any,
          limit: 1,
        })
      const profile = results[0] ?? null
      if (
        !profile ||
        !(await mayShowBadges(ctx, profile, { ownerSeesPrivate: true }))
      ) {
        return ctx.notFound("Profile not found")
      }

      return ctx.send({
        data: await strapi
          .service("api::drive.drive")
          .helpedBy(profile.baUserId),
      })
    },
  })
)
