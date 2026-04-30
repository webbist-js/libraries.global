export default {
  async syncUser(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
        const baseUsername = email
          .split("@")[0]
          .replaceAll(/[^a-z0-9_]/gi, "")
          .toLowerCase()
        const suffix = Math.floor(Math.random() * 9000 + 1000)
        const count = await strapi
          .query("api::user-profile.user-profile")
          .count()
        await strapi.query("api::user-profile.user-profile").create({
          data: {
            baUserId,
            username: `${baseUsername}${suffix}`,
            firstName,
            lastName,
            contributorNumber: count + 1,
          },
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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, ...fields } = ctx.request.body as {
      baUserId: string
      [k: string]: unknown
    }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

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

    const existing = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    // Create path uses db.query; update path uses Document Service so that
    // repeatable components + relation sets are handled correctly in Strapi v5.
    await (existing
      ? strapi.documents("api::user-profile.user-profile").update({
          documentId: existing.documentId,
          data,
        })
      : strapi
          .query("api::user-profile.user-profile")
          .create({ data: { baUserId, ...data } }))

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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, entityRef, role, department, verificationMethod } = ctx
      .request.body as {
      baUserId?: string
      entityRef?: string
      role?: string
      department?: string
      verificationMethod?: string
    }
    if (!baUserId || !entityRef)
      return ctx.badRequest("Missing baUserId or entityRef")

    const library = await strapi.db
      .query("api::library.library")
      .findOne({ where: { entityRef } })

    const affiliationData: Record<string, unknown> = {
      baUserId,
      role: role ?? null,
      department: department ?? null,
      verificationMethod: verificationMethod ?? "contact_us",
    }
    if (library) {
      affiliationData.library = { connect: [{ id: library.id }] }
    }
    await strapi
      .documents("api::library-affiliation.library-affiliation")
      .create({ data: affiliationData as any })

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (profile) {
      await strapi.db.query("api::user-profile.user-profile").update({
        where: { id: profile.id },
        data: {
          isVerifiedLibrarian: true,
          contributorRole: "verified_librarian",
        },
      })
    }

    return ctx.send({ ok: true })
  },

  async affiliationCount(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.query as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: { baUserId }, populate: { library: true } })

    const entityRefs = affiliations
      .map((a: any) => a.library?.entityRef)
      .filter(Boolean) as string[]

    return ctx.send({ entityRefs })
  },

  async toggleFollow(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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

  async computeQuickWins(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
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
