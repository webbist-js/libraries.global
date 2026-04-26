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

    const allowedFields = [
      "username",
      "firstName",
      "lastName",
      "bio",
      "pronouns",
      "affiliation",
      "affiliationType",
      "role",
      "claimedLibraryEntityRef",
      "claimedLibraryName",
      "claimedLibraryRole",
      "claimedLibraryDepartment",
      "affiliationVerificationStatus",
      "affiliationVerificationMethod",
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
}
