import { factories } from "@strapi/strapi"

import { isValidServiceSecret } from "../../../utils/service-secret"

const UID = "api::saved-event.saved-event"

/** Returns the Better Auth user id for a bridge-authenticated request, else null. */
function bridgeUserId(ctx: any): string | null {
  if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
    return null
  const id = ctx.request.headers["x-ba-user-id"]

  return typeof id === "string" && id.length > 0 && id.length <= 128 ? id : null
}

const toPublic = (r: any) => ({
  documentId: r.documentId,
  eventDocumentId: r.eventDocumentId,
  createdAt: r.createdAt,
})

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /api/saved-events — list the current user's saved events
  async find(ctx) {
    const baUserId = bridgeUserId(ctx)
    if (!baUserId) return ctx.unauthorized()

    const results = await strapi.documents(UID).findMany({
      filters: { baUserId: { $eq: baUserId } } as never,
      sort: "createdAt:desc",
      limit: 500,
    } as never)

    ctx.body = (results as any[]).map(toPublic)
  },

  // POST /api/saved-events { eventDocumentId } — save an event (idempotent)
  async create(ctx) {
    const baUserId = bridgeUserId(ctx)
    if (!baUserId) return ctx.unauthorized()

    const { eventDocumentId } = (ctx.request.body ?? {}) as {
      eventDocumentId?: unknown
    }
    if (
      typeof eventDocumentId !== "string" ||
      !eventDocumentId ||
      eventDocumentId.length > 64
    )
      return ctx.badRequest("eventDocumentId required")

    const existing = await strapi.documents(UID).findFirst({
      filters: {
        baUserId: { $eq: baUserId },
        eventDocumentId: { $eq: eventDocumentId },
      } as never,
    })
    if (existing) {
      ctx.body = toPublic(existing)

      return
    }

    const created = await strapi.documents(UID).create({
      data: { eventDocumentId, baUserId } as never,
    })
    ctx.status = 201
    ctx.body = toPublic(created)
  },

  // DELETE /api/saved-events/:documentId — unsave (own records only)
  async delete(ctx) {
    const baUserId = bridgeUserId(ctx)
    if (!baUserId) return ctx.unauthorized()

    const { id: documentId } = ctx.params as { id: string }
    const record = await strapi.documents(UID).findFirst({
      filters: {
        documentId: { $eq: documentId },
        baUserId: { $eq: baUserId },
      } as never,
    })
    // Same response whether it doesn't exist or belongs to someone else.
    if (!record) return ctx.notFound()

    await strapi.documents(UID).delete({ documentId })
    ctx.status = 204
  },
}))
