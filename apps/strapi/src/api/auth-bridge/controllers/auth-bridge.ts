import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import {
  libraryTypeName,
  isDismissiblePrompt,
  isExistingProfileTarget,
  isProfileBackground,
  mergeNotificationPreferences,
} from "@repo/shared-data"
import freeEmailDomains from "free-email-domains"

import { ownedUploadIds } from "../../../plugins/content-moderation/server/utils/uploads"
import {
  claimAffiliationFilter,
  grantVerifiedLibrarian,
  upsertAffiliation,
} from "../../../utils/affiliations"
import { loadPlanRows } from "../../../utils/entitlement-inputs"
import { eraseAccount } from "../../../utils/erase-account"
import { internalNotifications } from "../../../utils/internal-notifications/service"
import { activeGrants } from "../../../utils/role-grants"
import { isValidServiceSecret } from "../../../utils/service-secret"
import { loadStaffClaims } from "../../../utils/staff"
import { isValidUsername, nextContributorNumber } from "../../../utils/username"

/**
 * Mailboxes anyone can register: the `free-email-domains` list (14k+
 * providers, e.g. btinternet.com) plus a few well-known ones kept here in
 * case the package ever drops them. A match on one of these never verifies.
 */
const FREE_MAIL_DOMAINS = new Set([
  ...(freeEmailDomains as string[]).map((d) => d.toLowerCase()),
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
])

function domainOf(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return ""
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)

    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

/** What a follow points at: a library or a drive, by documentId. */
type FollowTarget = { kind: "library" | "drive"; documentId: string }

/** The profile relation that holds each kind of follow. */
const FOLLOW_RELATION = {
  library: "followedLibraries",
  drive: "followedDrives",
} as const

/** A non-empty string id, or null. */
const nonEmptyId = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

/**
 * The follow target in a request: exactly one of `libraryDocumentId` and
 * `driveDocumentId`, as a non-empty string. Null when neither or both are
 * given (a repeated query key arrives as an array, which is refused too).
 */
function followTargetOf(input: {
  libraryDocumentId?: unknown
  driveDocumentId?: unknown
}): FollowTarget | null {
  const library = nonEmptyId(input.libraryDocumentId)
  const drive = nonEmptyId(input.driveDocumentId)
  if (library && drive) return null
  if (library) return { kind: "library", documentId: library }
  if (drive) return { kind: "drive", documentId: drive }

  return null
}

export default {
  async syncUser(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { email, name, provider, baUserId } = ctx.request.body as {
      email?: string
      name?: string
      provider?: string
      baUserId?: string
    }
    if (!email || !provider)
      return ctx.badRequest("Missing required fields: email, provider")

    let user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } })
    if (!user) {
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } })
      if (!authenticatedRole)
        return ctx.internalServerError('"authenticated" role not found')
      user = await strapi.query("plugin::users-permissions.user").create({
        data: {
          email,
          username: email,
          provider,
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        },
      })
    }

    if (baUserId) {
      const existing = await strapi
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId } })
      if (!existing) {
        const nameParts = (name ?? "").trim().split(/\s+/)
        const firstName = nameParts[0] ?? ""
        const lastName = nameParts.slice(1).join(" ") || ""
        // username is intentionally left null — set during onboarding
        await strapi.documents("api::user-profile.user-profile").create({
          data: {
            baUserId,
            firstName,
            lastName,
            contributorNumber: await nextContributorNumber(strapi),
          } as any,
        })
      }
    }

    // Better Auth owns the session; the bridge never mints a Strapi JWT.
    return ctx.send({
      user: { id: user.id, email: user.email, username: user.username },
    })
  },

  async upsertProfile(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, ...fields } = ctx.request.body as {
      baUserId: string
      [k: string]: unknown
    }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const existing = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    // Only enforce the format rule when the username is actually changing —
    // existing users with a non-conforming username (created before this
    // rule) must still be able to save other profile fields.
    if (
      "username" in fields &&
      fields.username !== null &&
      fields.username !== existing?.username &&
      !isValidUsername(fields.username)
    )
      return ctx.badRequest(
        "Username must be 3–30 characters: lowercase letters, numbers and underscores."
      )

    // Scalar fields the user is allowed to set directly.
    // Trust-level fields (isVerifiedLibrarian, contributorRole) are written
    // exclusively by the moderation service on claim approval.
    const scalarFields = [
      "username",
      "firstName",
      "lastName",
      "bio",
      "pronouns",
      "affiliation",
      "affiliationType",
      "jobTitle",
      "city",
      "country",
      "timezone",
      "website",
      "orcid",
      "mastodon",
      "linkedin",
      "profileVisibility",
      "publicPrefs",
      "theme",
      "appearancePreference",
      "profileBackground",
    ]

    if (
      "profileBackground" in fields &&
      !isProfileBackground(fields.profileBackground)
    )
      return ctx.badRequest("Invalid profile background")

    if (
      "appearancePreference" in fields &&
      !["light", "dark", "system"].includes(
        fields.appearancePreference as string
      )
    )
      return ctx.badRequest("Invalid appearance preference")

    const data: Record<string, unknown> = {}
    for (const key of scalarFields) {
      if (key in fields) data[key] = fields[key] === "" ? null : fields[key]
    }
    if ("notifPrefs" in fields) {
      try {
        data.notifPrefs = mergeNotificationPreferences(
          existing?.notifPrefs,
          fields.notifPrefs
        )
      } catch {
        return ctx.badRequest("Invalid notification preferences")
      }
    }

    // Recognition preferences are independent, and never grant a plan.
    for (const key of ["supporterListed", "supporterBadgeVisible"] as const) {
      if (!(key in fields)) continue
      if (typeof fields[key] !== "boolean")
        return ctx.badRequest(`${key} must be a boolean`)
      data[key] = fields[key]
    }
    // Taking a profile out of public view also opts it out of the directory.
    // Returning to public requires an explicit opt-in rather than relisting it.
    const visibility =
      fields.profileVisibility ?? existing?.profileVisibility ?? "public"
    if (visibility !== "public") data.supporterListed = false

    // dismissedPrompts: the prompts the user has hidden, known keys only.
    if ("dismissedPrompts" in fields) {
      data.dismissedPrompts = Array.isArray(fields.dismissedPrompts)
        ? [...new Set(fields.dismissedPrompts.filter(isDismissiblePrompt))]
        : []
    }

    // languages: passed as [{ code, proficiency }] — Document Service writes
    // repeatable components directly from the array.
    if ("languages" in fields) {
      data.languages = Array.isArray(fields.languages) ? fields.languages : []
    }

    // interests: passed as string[] of topic documentIds — look up each topic
    // to get its name/slug, then store the full objects as JSON.
    // (JSON field avoids a cross-plugin manyToMany relation that Strapi v5 does
    // not reliably resolve at metadata-load time.)
    if ("interests" in fields) {
      const ids = Array.isArray(fields.interests)
        ? (fields.interests as string[])
        : []
      if (ids.length === 0) {
        data.interests = []
      } else {
        try {
          const topics = await strapi
            .documents("api::topic.topic" as any)
            .findMany({
              filters: { documentId: { $in: ids } } as any,
              fields: ["documentId", "name", "slug"] as any,
              limit: ids.length,
            })
          data.interests = (topics ?? []).map((t: any) => ({
            documentId: t.documentId,
            name: t.name,
            slug: t.slug,
          }))
        } catch {
          data.interests = []
        }
      }
    }

    // Trusted upload adapters may attach only media durably owned by this user.
    // Null clears a relation without deleting the underlying uploaded file.
    for (const [field, relation] of [
      ["avatarFileId", "avatar"],
      ["coverImageFileId", "coverImage"],
    ] as const) {
      if (!(field in fields)) continue
      const fileId = fields[field]
      if (fileId === null) {
        data[relation] = null
        continue
      }
      if (!Number.isSafeInteger(fileId) || Number(fileId) < 1)
        return ctx.badRequest("Invalid profile image")
      const owned = await ownedUploadIds(strapi, baUserId, [Number(fileId)])
      if (!owned.has(Number(fileId)))
        return ctx.forbidden("Profile image is not owned by this user")
      const file = await strapi.db
        .query("plugin::upload.file")
        .findOne({ where: { id: fileId }, select: ["id", "mime"] })
      if (
        !file ||
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.mime
        )
      )
        return ctx.badRequest("Invalid profile image")
      data[relation] = Number(fileId)
    }

    // Both paths use the Document Service so repeatable components (languages)
    // and relation sets are written correctly in Strapi v5.
    await (existing
      ? strapi.documents("api::user-profile.user-profile").update({
          documentId: existing.documentId,
          data,
        })
      : strapi.documents("api::user-profile.user-profile").create({
          data: { baUserId, ...data } as any,
        }))

    const updated = await strapi
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId },
        populate: {
          avatar: true,
          coverImage: true,
          languages: true,
          followedLibraries: true,
        },
      })
    const { baUserId: _id, ...safe } = updated

    return ctx.send({ data: safe })
  },

  async followStatus(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.query as { baUserId?: unknown }
    const target = followTargetOf(ctx.query ?? {})
    if (typeof baUserId !== "string" || !baUserId || !target)
      return ctx.badRequest(
        "Missing baUserId, or one of libraryDocumentId and driveDocumentId"
      )

    const relation = FOLLOW_RELATION[target.kind]
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId },
        populate: {
          [relation]:
            target.kind === "drive"
              ? {
                  where: { documentId: target.documentId },
                  select: ["documentId"],
                }
              : true,
        },
      })
    if (!profile) return ctx.send({ following: false })

    const following = ((profile[relation] ?? []) as any[]).some(
      (row: any) => row.documentId === target.documentId
    )

    return ctx.send({ following })
  },

  async deleteProfile(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, email } = ctx.request.body as {
      baUserId?: string
      email?: string
    }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    await eraseAccount(strapi, { baUserId, email })

    return ctx.send({ ok: true })
  },

  async createAffiliation(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const {
      baUserId,
      entityRef,
      role,
      department,
      verificationMethod,
      userEmail,
      emailVerified,
    } = ctx.request.body as {
      baUserId?: string
      entityRef?: string
      role?: string
      department?: string
      verificationMethod?: string
      userEmail?: string
      emailVerified?: boolean
    }
    if (!baUserId || !entityRef)
      return ctx.badRequest("Missing baUserId or entityRef")

    const library = (await strapi.documents("api::library.library").findFirst({
      status: "published",
      filters: { entityRef: { $eq: entityRef } } as any,
      fields: ["documentId", "website"] as any,
    })) as { documentId: string; website?: string | null } | null
    if (!library) return ctx.notFound("Library not found")

    // This endpoint only handles email-domain auto-verification. The domain
    // is checked against the library's *stored* website — never a domain
    // supplied by the caller, and never the library's contact email (a
    // shared mail host such as a council or a hosting provider would
    // otherwise verify every one of its users). Moderated claims create
    // affiliations in the content-moderation service on approval.
    if (verificationMethod !== "email_domain")
      return ctx.badRequest("Unsupported verificationMethod")
    if (emailVerified !== true || !userEmail)
      return ctx.forbidden("email_not_verified")
    const emailDomain = userEmail.split("@")[1]?.toLowerCase() ?? ""
    const websiteDomain = domainOf(library.website)
    if (
      !emailDomain ||
      !websiteDomain ||
      FREE_MAIL_DOMAINS.has(emailDomain) ||
      emailDomain !== websiteDomain
    ) {
      return ctx.forbidden("domain_mismatch")
    }

    await upsertAffiliation(strapi, {
      baUserId,
      libraryDocumentId: library.documentId,
      // Pass through undefined (not null) when the caller didn't supply a
      // value, so an update doesn't null out an existing one.
      role,
      department,
      verificationMethod,
    })
    await grantVerifiedLibrarian(strapi, baUserId)

    return ctx.send({ ok: true })
  },

  async affiliationCount(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { entityRef } = ctx.query as { entityRef?: string }
    if (!entityRef) return ctx.badRequest("Missing entityRef")

    const count = await strapi
      .documents("api::library-affiliation.library-affiliation")
      .count({
        filters: { library: { entityRef: { $eq: entityRef } } } as any,
      })

    return ctx.send({ count })
  },

  async claimStatus(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, entityRef } = ctx.query as {
      baUserId?: string
      entityRef?: string
    }
    if (!baUserId || !entityRef)
      return ctx.badRequest("Missing baUserId or entityRef")

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: { baUserId }, populate: { library: true } })

    const match = affiliations.find(
      (a: any) => a.library?.entityRef === entityRef
    )

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    return ctx.send({
      isVerifiedLibrarian: !!(profile?.isVerifiedLibrarian && match),
      claimedLibraryEntityRef: match ? entityRef : null,
    })
  },

  async getUserAffiliations(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.query as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const affiliations = await strapi
      .documents("api::library-affiliation.library-affiliation")
      .findMany({
        filters: { baUserId } as any,
        populate: {
          library: {
            populate: {
              libraryType: { fields: ["name"] },
              heroImage: { fields: ["url"] },
            },
          },
        } as any,
      })

    const entityRefs = affiliations
      .map((a: any) => a.library?.entityRef)
      .filter(Boolean) as string[]

    const libraries = affiliations
      .filter((a: any) => a.library)
      .map((a: any) => ({
        entityRef: a.library.entityRef ?? null,
        documentId: a.library.documentId ?? null,
        name: a.library.name ?? null,
        slug: a.library.slug ?? null,
        libraryType: libraryTypeName(a.library.libraryType) ?? null,
        heroImageUrl: a.library.heroImage?.url ?? null,
      }))

    return ctx.send({ entityRefs, libraries })
  },

  async toggleFollow(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const body = (ctx.request.body ?? {}) as {
      baUserId?: string
      action?: "follow" | "unfollow"
      libraryDocumentId?: unknown
      driveDocumentId?: unknown
    }
    const { baUserId, action } = body
    const target = followTargetOf(body)
    if (!baUserId || !target || (action !== "follow" && action !== "unfollow"))
      return ctx.badRequest(
        "Missing baUserId, action, or one of libraryDocumentId and driveDocumentId"
      )

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return ctx.notFound("Profile not found")

    if (target.kind === "drive") {
      // A drive has one row per locale. Only a drive past `draft` (its
      // lifecycle status; drives have no draft & publish) can be followed;
      // the follow links its first row, and an unfollow unlinks every row,
      // whatever the drive's status is now.
      const rows = (await strapi.db.query("api::drive.drive").findMany({
        where: {
          documentId: target.documentId,
          ...(action === "follow" ? { status: { $ne: "draft" } } : {}),
        },
        select: ["id"],
        orderBy: { id: "asc" },
      })) as { id: number }[]
      if (rows.length === 0) return ctx.notFound("Drive not found")

      await strapi.db.query("api::user-profile.user-profile").update({
        where: { id: profile.id },
        data: {
          followedDrives:
            action === "follow"
              ? { connect: [{ id: rows[0]!.id }] }
              : { disconnect: rows.map((row) => ({ id: row.id })) },
        },
      })

      return ctx.send({ following: action === "follow" })
    }

    // Only a published row can be followed: the relation links to a row id,
    // so linking a draft would make the follow vanish from every read.
    const library = await strapi.db.query("api::library.library").findOne({
      where: {
        documentId: target.documentId,
        publishedAt: { $notNull: true },
      },
    })
    if (!library) return ctx.notFound("Library not found")

    await strapi.db.query("api::user-profile.user-profile").update({
      where: { id: profile.id },
      data: {
        followedLibraries: {
          [action === "follow" ? "connect" : "disconnect"]: [
            { id: library.id },
          ],
        },
      },
    })

    return ctx.send({ following: action === "follow" })
  },

  async toggleFollowUser(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, targetUsername, action } = ctx.request.body as {
      baUserId?: string
      targetUsername?: string
      action?: "follow" | "unfollow"
    }
    if (
      typeof baUserId !== "string" ||
      !baUserId ||
      baUserId.length > 200 ||
      typeof targetUsername !== "string" ||
      !isExistingProfileTarget(targetUsername) ||
      !["follow", "unfollow"].includes(action ?? "")
    )
      return ctx.badRequest("Missing baUserId, targetUsername, or action")

    const followerProfile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, populate: { followedProfiles: true } })
    if (!followerProfile) return ctx.notFound("Follower profile not found")

    const targetResults = await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({ where: { username: targetUsername }, limit: 1 })
    const targetProfile = targetResults[0] ?? null
    if (!targetProfile) return ctx.notFound("Target profile not found")

    // Only public profiles can be followed
    if (targetProfile.profileVisibility !== "public") {
      return ctx.forbidden("This profile cannot be followed")
    }

    if (targetProfile.id === followerProfile.id)
      return ctx.badRequest("You cannot follow yourself")
    await strapi.db.transaction(async ({ trx }: any) => {
      // Serialise simultaneous follow/unfollow requests before checking the edge.
      // Otherwise a duplicate queue insert could abort the relation transaction.
      if (typeof trx?.raw === "function")
        await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
          `profile-follow:${baUserId}`,
        ])
      const current = await strapi.db
        .query("api::user-profile.user-profile")
        .findOne({
          where: { id: followerProfile.id },
          populate: { followedProfiles: true },
        })
      const alreadyFollowing = (current?.followedProfiles ?? []).some(
        (p: any) => p.id === targetProfile.id
      )
      if (alreadyFollowing === (action === "follow")) return
      await strapi.db.query("api::user-profile.user-profile").update({
        where: { id: followerProfile.id },
        data: {
          followedProfiles: {
            [action === "follow" ? "connect" : "disconnect"]: [
              { id: targetProfile.id },
            ],
          },
        },
      })
      if (action === "follow") {
        // Incoming follower identities stay private; the notification reveals no name.
        await strapi.service("api::notification.notification").enqueue({
          baUserId: targetProfile.baUserId,
          eventKey: `follower:${targetProfile.baUserId}:${baUserId}`,
          kind: "new_follower",
          title: "You have a new follower",
          body: "Another contributor is following your profile.",
          href: `/profile/${encodeURIComponent(targetUsername)}`,
          emailPreference: "newFollowers",
        })
      }
    })

    return ctx.send({ following: action === "follow" })
  },

  async userFollowStatus(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, targetUsername } = ctx.query as {
      baUserId?: string
      targetUsername?: string
    }
    if (
      typeof baUserId !== "string" ||
      !baUserId ||
      baUserId.length > 200 ||
      !isExistingProfileTarget(targetUsername)
    )
      return ctx.badRequest("Missing baUserId or targetUsername")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId },
        populate: { followedProfiles: true },
      })
    if (!profile) return ctx.send({ following: false })

    const following = (profile.followedProfiles ?? []).some(
      (p: any) => p.username === targetUsername
    )

    return ctx.send({ following })
  },

  async sessionProfile(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    // A repeated ?baUserId= arrives as an array; only one non-empty id is valid.
    const { baUserId } = ctx.query as { baUserId?: unknown }
    if (typeof baUserId !== "string" || baUserId.length === 0)
      return ctx.badRequest("Missing baUserId")

    const [[profile], affiliations, planRows, roleGrants] = await Promise.all([
      strapi.documents("api::user-profile.user-profile").findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: [
          "contributorRole",
          "username",
          "tier",
          "earnedProUntil",
          "points",
          "dismissedPrompts",
          "country",
        ],
        populate: { languages: { fields: ["code", "proficiency"] } },
        limit: 1,
      }) as Promise<
        {
          contributorRole?: string
          username?: string
          tier?: string
          earnedProUntil?: string | null
          points?: number
          dismissedPrompts?: unknown
          country?: string | null
          languages?: { code: string; proficiency: string }[]
        }[]
      >,
      strapi
        .documents("api::library-affiliation.library-affiliation")
        .findMany({
          filters: claimAffiliationFilter(baUserId) as any,
          populate: { library: { fields: ["documentId"] } },
          limit: SESSION_PROFILE_MAX_CLAIMS,
        }) as Promise<{ library?: { documentId?: string } }[]>,
      // Unexpired plan grants and Pro verifications (shared with the
      // Strapi-side entitlement checks, utils/entitlement-inputs).
      loadPlanRows(strapi, baUserId),
      // Unexpired Role Grants, at most MAX_ACTIVE_GRANTS. `grants` above
      // are plan grants; the two never mix.
      activeGrants(strapi, baUserId),
    ])

    if (profile && process.env.INTERNAL_NOTIFICATIONS_ENABLED === "true") {
      try {
        await internalNotifications(strapi).active(baUserId)
      } catch {
        strapi.log.warn(
          "[internal-notifications] Could not record beta activity"
        )
      }
    }

    // Teams (R2-B): active memberships, with each Team's libraries, so the
    // session resolves Pro (source `team`) and `teamLibraryIds` itself.
    const teams: {
      id: string
      name: string
      slug: string
      role: "organiser" | "member"
      libraryCount: number
      libraryDocumentIds: string[]
      expiresAt: string | null
      status: "active" | "lapsed"
      organiserName: string | null
      selfService?: boolean
    }[] =
      (await strapi
        .plugin("access")
        ?.service("teams")
        ?.listMine(baUserId)
        .catch((err: unknown) => {
          strapi.log.warn("[auth-bridge] teams lookup failed", err)

          return []
        })) ?? []

    // Staff memberships, then one query for their libraries' names.
    const staffClaims = await loadStaffClaims(strapi, baUserId)
    const staffLibraries = new Map<string, any>(
      staffClaims.length
        ? (
            (await strapi.documents("api::library.library").findMany({
              populate: { libraryType: { fields: ["name"] } },
              filters: {
                documentId: {
                  $in: staffClaims.map((claim) => claim.libraryDocumentId),
                },
              },
              status: "published",
              fields: ["documentId", "name", "slug"],
              limit: staffClaims.length,
            })) as any[]
          ).map((library) => [library.documentId, library])
        : []
    )

    return ctx.send({
      contributorRole: profile?.contributorRole ?? "reader",
      staff: staffClaims.flatMap((claim) => {
        const library = staffLibraries.get(claim.libraryDocumentId)

        return library
          ? [
              {
                ...claim,
                name: library.name ?? "Library",
                slug: library.slug ?? "",
                libraryType: libraryTypeName(library.libraryType) ?? "",
              },
            ]
          : []
      }),
      username: profile?.username ?? null,
      country: profile?.country ?? null,
      languages: (profile?.languages ?? []).map(({ code, proficiency }) => ({
        code,
        proficiency,
      })),
      tier: profile?.tier ?? null,
      claims: affiliations
        .map((a) => a.library?.documentId)
        .filter((id): id is string => !!id),
      grants: planRows.grants,
      ...(planRows.paidMembership
        ? { paidMembership: planRows.paidMembership }
        : {}),
      roleGrants,
      verifications: planRows.verifications,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        libraryCount: t.libraryCount,
        ...(t.selfService ? { selfService: true } : {}),
        libraryDocumentIds: t.libraryDocumentIds,
        expiresAt: t.expiresAt,
        status: t.status,
        organiserName: t.organiserName,
      })),
      earnedProUntil: profile?.earnedProUntil ?? null,
      rewardsPoints: profile?.points ?? 0,
      dismissedPrompts: Array.isArray(profile?.dismissedPrompts)
        ? profile.dismissedPrompts.filter(isDismissiblePrompt)
        : [],
    })
  },
}
