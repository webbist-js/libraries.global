import { isDocumentId } from "../utils/params"
import { isValidServiceSecret } from "../utils/service-secret"

export default ({ strapi }: { strapi: any }) => ({
  // GET /content-moderation/submissions?status=pending  (admin route)
  async findAll(ctx: any) {
    // auth handled by admin::isAuthenticatedAdmin policy on the route
    const { status } = ctx.query as { status?: string }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findAll(status)
    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/submissions/stats  (content-api route, public)
  // Returns aggregate counts for the homepage contribute CTA and hero stats bar.
  async stats(ctx: any) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      submissionsToday,
      indexedLibraries,
      totalContributors,
      totalCountries,
      languageRow,
    ] = await Promise.all([
      strapi.db.query("plugin::content-moderation.submission").count({
        where: { status: { $ne: "draft" }, createdAt: { $gte: todayStart } },
      }),
      strapi.db
        .query("api::library.library")
        .count({ where: { published_at: { $notNull: true }, locale: "en" } }),
      strapi.db.query("api::user-profile.user-profile").count({}),
      strapi.db
        .query("api::country.country")
        .count({ where: { published_at: { $notNull: true }, locale: "en" } }),
      // Count distinct language codes across all contributor profiles
      strapi.db.connection
        .table("components_profile_language_entries")
        .countDistinct("code as count")
        .first() as Promise<{ count: string | number } | undefined>,
    ])

    const totalLanguages = Number((languageRow as any)?.count ?? 0)

    ctx.body = {
      data: {
        submissionsToday,
        indexedLibraries,
        totalContributors,
        totalCountries,
        totalLanguages,
      },
    }
  },

  // POST /api/content-moderation/submissions  (content-api route)
  async create(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }
    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
      verificationMethod,
      editSummary,
      evidenceType,
      evidenceUrl,
      asDraft,
    } = ctx.request.body as Record<string, unknown>

    if (!submissionType) {
      return ctx.badRequest("submissionType is required")
    }

    const submission = await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType,
        targetEntityType,
        targetDocumentId,
        targetSlug,
        fields,
        note,
        verificationMethod,
        editSummary,
        evidenceType,
        evidenceUrl,
        submittedByUserId: user.id,
        submittedByEmail: user.email,
        submittedByName: user.name,
        asDraft: !!asDraft,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/by-document-id/:documentId  (content-api route)
  // Returns public submissions for a given user-profile documentId.
  async findByDocumentId(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    if (!documentId) return ctx.badRequest("Missing documentId")

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findPublicByDocumentId(documentId)

    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/libraries/:documentId/revisions  (content-api route)
  // Public, sanitized revision history for a library (approved submissions only).
  async libraryRevisions(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    if (!documentId) return ctx.badRequest("Missing documentId")

    const revisions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findLibraryRevisions(documentId)

    ctx.body = { data: revisions }
  },

  // GET /api/content-moderation/submissions/by-username/:username  (content-api route)
  // Returns public (non-draft) submissions for a given profile username.
  async findByUsername(ctx: any) {
    const { username } = ctx.params as { username: string }
    if (!username) return ctx.badRequest("Missing username")

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findPublicByUsername(username)

    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/submissions/my  (content-api route)
  async findMine(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(user.id)
    ctx.body = { data: submissions }
  },

  // GET /content-moderation/relation-labels?type=services  (admin route only)
  // Resolves a relation type to a {documentId → name} map using the Document Service API.
  async relationLabels(ctx: any) {
    const { type } = ctx.query as { type?: string }

    const UID_MAP: Record<string, string> = {
      services: "api::service.service",
      amenities: "api::amenity.amenity",
      accessibility: "api::accessibility.accessibility",
    }

    const uid = type ? UID_MAP[type] : undefined
    if (!uid) {
      return ctx.badRequest(
        `Unknown relation type. Must be one of: ${Object.keys(UID_MAP).join(", ")}`
      )
    }

    try {
      const results = await strapi.documents(uid).findMany({
        fields: ["documentId", "name"],
        pagination: { limit: 500 },
        status: "published",
      })

      const labels: Record<string, string> = {}
      for (const item of results ?? []) {
        if (item.documentId && item.name) {
          labels[item.documentId] = item.name
        }
      }

      ctx.body = { data: labels }
    } catch (err) {
      strapi.log.error("[content-moderation] relationLabels error", err)
      ctx.body = { data: {} }
    }
  },

  // PUT  /content-moderation/submissions/:id/status   (admin route only)
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { status, reviewNote } = (ctx.request.body ?? {}) as {
      status: string
      reviewNote?: string
    }

    const VALID_STATUSES = ["approved", "rejected", "needs_info", "pending"]
    if (!VALID_STATUSES.includes(status)) {
      return ctx.badRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      )
    }

    const reviewer = ctx.state.user ?? ctx.state.admin
    const reviewerId = String(reviewer?.id ?? "unknown")

    const target = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId: id })
    if (
      target &&
      reviewer?.email &&
      target.submittedByEmail &&
      String(reviewer.email).toLowerCase() ===
        String(target.submittedByEmail).toLowerCase()
    )
      return ctx.forbidden("You can't review your own submission.")

    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, reviewerId, reviewNote)

    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      if (result.error === "apply_failed") {
        ctx.status = 500
        ctx.body = {
          error: {
            status: 500,
            name: result.error,
            message:
              "Approval could not be applied; the submission was returned to review. Check the server log.",
          },
        }

        return
      }
      ctx.status = 409
      ctx.body = {
        error: {
          status: 409,
          name: result.error,
          message: `Cannot change status: ${result.error}`,
        },
      }

      return
    }
    ctx.body = { data: result.data }
  },

  // PATCH /api/content-moderation/submissions/:id/finalize  (content-api route)
  // Promotes a draft submission to "pending" — makes it visible to the moderation queue.
  async finalize(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    let body: Record<string, unknown>
    try {
      body = (await ctx.request.body) as Record<string, unknown>
    } catch {
      return ctx.badRequest("Invalid request body")
    }
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .finalizeDraft(id, user.id, body)
    if (!result) return ctx.notFound("Draft not found or already finalized.")
    ctx.body = { data: result }
  },

  // PATCH /api/content-moderation/submissions/:id/draft  (content-api route)
  async saveDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { draftData, stepCompleted } = (ctx.request.body ?? {}) as {
      draftData?: Record<string, unknown>
      stepCompleted?: number
    }
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .saveDraft(id, user.id, draftData ?? {}, Number(stepCompleted) || 0)
    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      if (result.error === "forbidden")
        return ctx.forbidden("You do not own this submission.")
      if (typeof ctx.conflict === "function") {
        return ctx.conflict(
          "This submission is already in review and can't be edited."
        )
      }
      ctx.status = 409
      ctx.body = {
        error: {
          status: 409,
          message: "This submission is already in review and can't be edited.",
        },
      }

      return
    }
    ctx.body = { data: result.data }
  },

  // POST /api/content-moderation/uploads  (content-api route, secret-gated)
  async recordUpload(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized()
    const fileId = Number((ctx.request.body as any)?.fileId)
    if (!Number.isInteger(fileId)) return ctx.badRequest("fileId required")
    await strapi
      .plugin("content-moderation")
      .service("submission")
      .recordUpload(fileId, user.id)
    ctx.body = { ok: true }
  },

  // GET /api/content-moderation/submissions/draft/:type  (content-api route)
  async findDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { type } = ctx.params as { type: string }
    const { targetSlug } = ctx.query as { targetSlug?: string }
    const draft = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findDraft(user.id, type, targetSlug)
    ctx.body = { data: draft }
  },
})

// Resolves the calling user from the request.
// Accepts two auth patterns:
//   1. Service-to-service: X-Service-Secret header (from Next.js API routes) +
//      X-Ba-User-Id / X-Ba-User-Email / X-Ba-User-Name headers carrying identity
//   2. Better Auth session cookie (requires strapi-better-auth plugin)
//   3. Strapi users-permissions JWT in Authorization: Bearer header (fallback)
async function resolveUser(
  strapi: any,
  ctx: any
): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    // Pattern 1: service-to-service via X-Service-Secret
    if (isValidServiceSecret(ctx.request.headers["x-service-secret"])) {
      const userId = ctx.request.headers["x-ba-user-id"] as string | undefined
      const userEmail = ctx.request.headers["x-ba-user-email"] as
        | string
        | undefined
      const userName = (ctx.request.headers["x-ba-user-name"] as string) ?? ""
      if (userId && userEmail) {
        return { id: userId, email: userEmail, name: userName }
      }
    }

    // Pattern 2: strapi-better-auth plugin (when installed)
    if (strapi.betterAuth?.api?.getSession) {
      const session = await strapi.betterAuth.api.getSession({
        headers: ctx.request.headers,
      })

      return session?.user ?? null
    }

    // Pattern 3: Strapi users-permissions JWT
    if (ctx.state.user) {
      return {
        id: String(ctx.state.user.id),
        email: ctx.state.user.email,
        name: ctx.state.user.username,
      }
    }

    return null
  } catch {
    return null
  }
}
