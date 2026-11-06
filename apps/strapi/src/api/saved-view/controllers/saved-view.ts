import { factories } from "@strapi/strapi"

import {
  isSavedViewKind,
  SAVED_VIEW_UID as UID,
  savedLimitOf,
  savedViewInput,
} from "../../../utils/saved-views"
import { isValidServiceSecret } from "../../../utils/service-secret"

/** The Better Auth user id of a bridge-authenticated request, else null. */
function bridgeUserId(ctx: {
  request: { headers: Record<string, unknown> }
}): string | null {
  if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
    return null
  const id = ctx.request.headers["x-ba-user-id"]

  return typeof id === "string" && id.length > 0 && id.length <= 128 ? id : null
}

interface SavedViewRow {
  documentId: string
  kind?: unknown
  name?: unknown
  query?: unknown
  createdAt?: unknown
}

const toPublic = (r: SavedViewRow) => ({
  documentId: r.documentId,
  kind: r.kind,
  name: r.name,
  query: r.query ?? "",
  createdAt: r.createdAt,
})

export default factories.createCoreController(UID, ({ strapi }) => {
  const countOf = (baUserId: string, kind: string) =>
    strapi
      .documents(UID)
      .count({ filters: { baUserId: { $eq: baUserId }, kind } } as never)

  return {
    // GET /api/saved-views?kind=view|search: the account's saved items.
    async find(ctx) {
      const baUserId = bridgeUserId(ctx)
      if (!baUserId) return ctx.unauthorized()
      const kind = (ctx.query as Record<string, unknown>)?.kind
      if (kind !== undefined && !isSavedViewKind(kind))
        return ctx.badRequest("Unknown kind")

      const results = await strapi.documents(UID).findMany({
        filters: {
          baUserId: { $eq: baUserId },
          ...(kind ? { kind } : {}),
        } as never,
        sort: "createdAt:desc",
        limit: 1000,
      } as never)

      ctx.body = { data: (results as SavedViewRow[]).map(toPublic) }
    },

    // POST /api/saved-views { kind, name, query }, within the account's limit.
    async create(ctx) {
      const baUserId = bridgeUserId(ctx)
      if (!baUserId) return ctx.unauthorized()
      const input = savedViewInput(ctx.request.body)
      if (!input) return ctx.badRequest("Invalid saved view")
      const limit = savedLimitOf(ctx.request.headers["x-saved-limit"])
      if ((await countOf(baUserId, input.kind)) >= limit) {
        ctx.status = 403
        ctx.body = { error: "limit", limit }

        return
      }

      const created = await strapi
        .documents(UID)
        .create({ data: { ...input, baUserId } as never })
      // Two saves at once can both pass the check; undo the one over.
      if ((await countOf(baUserId, input.kind)) > limit) {
        await strapi.documents(UID).delete({ documentId: created.documentId })
        ctx.status = 403
        ctx.body = { error: "limit", limit }

        return
      }
      ctx.status = 201
      ctx.body = { data: toPublic(created) }
    },

    // DELETE /api/saved-views/:id: own items only.
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
      // The same answer whether it doesn't exist or belongs to someone else.
      if (!record) return ctx.notFound()

      await strapi.documents(UID).delete({ documentId })
      ctx.status = 204
    },
  }
})
