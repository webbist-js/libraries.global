import {
  grantVerifiedLibrarian,
  upsertAffiliation,
} from "../../../utils/affiliations"
import { isValidServiceSecret } from "../../../utils/service-secret"
import { isValidUsername } from "../../../utils/username"

const FREE_MAIL_DOMAINS = new Set([
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
        const count = await strapi
          .query("api::user-profile.user-profile")
          .count()
        // username is intentionally left null — set during onboarding
        await strapi.documents("api::user-profile.user-profile").create({
          data: {
            baUserId,
            firstName,
            lastName,
            contributorNumber: count + 1,
          } as any,
        })
      }
    }

    const jwt = strapi
      .plugin("users-permissions")
      .service("jwt")
      .issue({ id: user.id })

    return ctx.send({
      user: { id: user.id, email: user.email, username: user.username },
      jwt,
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
      "notifPrefs",
      "publicPrefs",
      "theme",
    ]

    const data: Record<string, unknown> = {}
    for (const key of scalarFields) {
      if (key in fields) data[key] = fields[key] === "" ? null : fields[key]
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

    // avatarFileId: integer ID of an already-uploaded Strapi file.
    // Passed by the avatar upload route after a successful /api/upload call.
    if ("avatarFileId" in fields && fields.avatarFileId != null) {
      data.avatar = Number(fields.avatarFileId)
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

    // Recompute quick wins if personalisation fields changed
    if (baUserId && ("country" in data || "languages" in data)) {
      strapi
        .service("api::user-profile.quick-wins")
        .computeAndSave(baUserId)
        .catch((err: unknown) =>
          strapi.log.warn("[quick-wins] upsertProfile recompute failed:", err)
        )
    }

    const updated = await strapi
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId },
        populate: {
          avatar: true,
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

    const { baUserId, libraryDocumentId } = ctx.query as {
      baUserId?: string
      libraryDocumentId?: string
    }
    if (!baUserId || !libraryDocumentId)
      return ctx.badRequest("Missing baUserId or libraryDocumentId")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, populate: { followedLibraries: true } })
    if (!profile) return ctx.send({ following: false })

    const following = (profile.followedLibraries ?? []).some(
      (lib: any) => lib.documentId === libraryDocumentId
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

    const profile = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (profile) {
      const anonUsername = `deleted-${profile.contributorNumber ?? profile.id}`
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId },
        data: {
          username: anonUsername,
          firstName: "Deleted",
          lastName: "User",
          bio: null,
          pronouns: null,
          affiliation: null,
          affiliationType: null,
          jobTitle: null,
          city: null,
          country: null,
          timezone: null,
          website: null,
          orcid: null,
          mastodon: null,
          linkedin: null,
          avatar: null,
          profileVisibility: "private",
          baUserId: `deleted-${baUserId}`,
        },
      })
    }

    // Scrub PII left on moderation and rewards records. These types all have
    // draftAndPublish: false, so bulk db.query updates are consistent with
    // the Document Service (see Global Constraints).
    await strapi.db.query("plugin::content-moderation.submission").updateMany({
      where: { submittedByUserId: baUserId },
      data: {
        submittedByEmail: "deleted@invalid",
        submittedByName: null,
        submittedByUserId: `deleted-${baUserId}`,
      },
    })
    await strapi.db.query("plugin::rewards.point-event").updateMany({
      where: { baUserId },
      data: { baUserId: `deleted-${baUserId}` },
    })
    await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .deleteMany({ where: { baUserId } })
    await strapi.db
      .query("plugin::content-moderation.submission-upload")
      .deleteMany({ where: { baUserId } })

    const upUser = email
      ? await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email } })
      : null
    if (upUser) {
      await strapi
        .query("plugin::users-permissions.user")
        .delete({ where: { id: upUser.id } })
    }

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

    const library = await strapi.db.query("api::library.library").findOne({
      where: { entityRef },
      select: ["id", "documentId", "website", "email"],
    })
    if (!library) return ctx.notFound("Library not found")

    // This endpoint only handles email-domain auto-verification. The domain is
    // checked here against the library's *stored* website/email — never a
    // domain supplied by the caller. Moderated claims create affiliations in
    // the content-moderation service on approval.
    if (verificationMethod !== "email_domain")
      return ctx.badRequest("Unsupported verificationMethod")
    if (emailVerified !== true || !userEmail)
      return ctx.forbidden("email_not_verified")
    const emailDomain = userEmail.split("@")[1]?.toLowerCase() ?? ""
    const libraryDomains = [
      domainOf(library.website),
      library.email?.split("@")[1]?.toLowerCase() ?? "",
    ].filter(Boolean)
    if (
      !emailDomain ||
      FREE_MAIL_DOMAINS.has(emailDomain) ||
      !libraryDomains.includes(emailDomain)
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

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: {}, populate: { library: true } })

    const count = affiliations.filter(
      (a: any) => a.library?.entityRef === entityRef
    ).length

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
            populate: { heroImage: { fields: ["url"] } },
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
        libraryType: a.library.libraryType ?? null,
        heroImageUrl: a.library.heroImage?.url ?? null,
      }))

    return ctx.send({ entityRefs, libraries })
  },

  async toggleFollow(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, libraryDocumentId, action } = ctx.request.body as {
      baUserId?: string
      libraryDocumentId?: string
      action?: "follow" | "unfollow"
    }
    if (!baUserId || !libraryDocumentId || !action)
      return ctx.badRequest("Missing baUserId, libraryDocumentId, or action")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return ctx.notFound("Profile not found")

    const library = await strapi.db
      .query("api::library.library")
      .findOne({ where: { documentId: libraryDocumentId } })
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
    if (!baUserId || !targetUsername || !action)
      return ctx.badRequest("Missing baUserId, targetUsername, or action")

    const followerProfile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
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
    if (!baUserId || !targetUsername)
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

    const { baUserId } = ctx.query as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, select: ["contributorRole", "username"] })

    return ctx.send({
      contributorRole: profile?.contributorRole ?? "reader",
      username: profile?.username ?? null,
    })
  },

  async computeQuickWins(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.request.body as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    try {
      await strapi
        .service("api::user-profile.quick-wins")
        .computeAndSave(baUserId)
    } catch (err) {
      strapi.log.warn("[quick-wins] computeAndSave failed:", err)
    }

    return ctx.send({ ok: true })
  },
}
