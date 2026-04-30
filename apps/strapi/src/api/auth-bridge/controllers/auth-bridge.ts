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

    // Find or create Strapi users-permissions user
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

    // Auto-create user-profile if baUserId provided and profile doesn't exist
    if (baUserId) {
      const existing = await strapi
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId } })
      if (!existing) {
        const nameParts = (name ?? "").trim().split(/\s+/)
        const firstName = nameParts[0] ?? ""
        const lastName = nameParts.slice(1).join(" ") || ""
        // Auto-generate username from email local part + random suffix
        const baseUsername = email
          .split("@")[0]
          .replaceAll(/[^a-z0-9_]/gi, "")
          .toLowerCase()
        const suffix = Math.floor(Math.random() * 9000 + 1000)
        // Count existing profiles for contributor number
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

    // Only user-controlled settings fields. Trust-level fields
    // (isVerifiedLibrarian, contributorRole) are written exclusively by
    // the moderation service on claim approval.
    const allowedFields = [
      "username",
      "firstName",
      "lastName",
      "bio",
      "pronouns",
      "affiliation",
      "affiliationType",
      "role",
      "city",
      "country",
      "timezone",
      "website",
      "orcid",
      "mastodon",
      "linkedin",
      "avatarUrl",
      "avatarStrapiId",
      "profileVisibility",
      "notifPrefs",
      "languages",
      "interests",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in fields) data[key] = fields[key]
    }

    const existing = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    await (!existing
      ? strapi
          .query("api::user-profile.user-profile")
          .create({ data: { baUserId, ...data } })
      : strapi
          .query("api::user-profile.user-profile")
          .update({ where: { baUserId }, data }))

    const updated = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
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
      // Anonymise personal data but retain the record so contribution refs don't break.
      // Username becomes deleted-{contributorNumber} to free the handle.
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
          role: null,
          city: null,
          country: null,
          timezone: null,
          website: null,
          orcid: null,
          mastodon: null,
          linkedin: null,
          avatarUrl: null,
          avatarStrapiId: null,
          profileVisibility: "private",
          baUserId: `deleted-${baUserId}`, // free the key so re-registration is possible
        },
      })
    }

    // Also remove the Strapi users-permissions user tied to this BA user
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

    // Find the library by entityRef
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
      .create({
        data: affiliationData as any,
      })

    // Mark the profile as verified
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
      .findMany({
        where: { baUserId },
        populate: { library: true },
      })

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

    // Resolve library integer id from documentId (strapi.db.query uses integer PKs)
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
}
