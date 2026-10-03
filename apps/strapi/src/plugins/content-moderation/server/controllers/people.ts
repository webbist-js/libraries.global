import { configuredLocales } from "../utils/locales"
import { isDocumentId } from "../utils/params"
import {
  isBaUserId,
  parseGrantInput,
  parseRevokeReason,
} from "../services/people"

/**
 * The People tab (admin routes, `plugin::content-moderation.manage-roles`).
 * The admin is always `ctx.state.user`; nothing about who acts comes from
 * the body.
 */

function fail(ctx: any, status: number, message: string): void {
  ctx.status = status
  ctx.body = { error: { status, message } }
}

const adminOf = (ctx: any): { id: string | number } | null => {
  const admin = ctx.state?.user ?? ctx.state?.admin
  const id = admin?.id

  return typeof id === "number" || typeof id === "string" ? { id } : null
}

export default ({ strapi }: { strapi: any }) => {
  const people = () => strapi.plugin("content-moderation").service("people")

  return {
    // GET /people?q=
    async search(ctx: any) {
      const q = ctx.query?.q
      if (q !== undefined && typeof q !== "string")
        return fail(ctx, 400, "q must be text")
      if (typeof q === "string" && q.length > 100)
        return fail(ctx, 400, "q is limited to 100 characters")
      ctx.set?.("Cache-Control", "no-store")
      ctx.body = { data: await people().search(q ?? "") }
    },

    // GET /people/:baUserId
    async findOne(ctx: any) {
      const { baUserId } = (ctx.params ?? {}) as { baUserId?: unknown }
      if (!isBaUserId(baUserId)) return fail(ctx, 400, "Invalid user id")
      const person = await people().person(baUserId)
      if (!person) return fail(ctx, 404, "No profile for that user.")
      ctx.set?.("Cache-Control", "no-store")
      ctx.body = { data: person }
    },

    // POST /people/:baUserId/grants  { role, queue?, scopeLocale?, reason, expiresAt? }
    async createGrant(ctx: any) {
      const admin = adminOf(ctx)
      if (!admin) return fail(ctx, 401, "Sign in to the admin first.")
      const { baUserId } = (ctx.params ?? {}) as { baUserId?: unknown }
      if (!isBaUserId(baUserId)) return fail(ctx, 400, "Invalid user id")
      const parsed = parseGrantInput(
        ctx.request?.body,
        await configuredLocales(strapi)
      )
      if (!parsed.ok) return fail(ctx, 400, parsed.message)

      const result = await people().grant(baUserId, parsed.value, admin.id)
      if (!result.ok)
        return result.error === "no_profile"
          ? fail(ctx, 404, "No profile for that user.")
          : fail(
              ctx,
              409,
              "They already hold this role for that queue and language."
            )
      strapi.log.info(
        `[content-moderation] admin:${admin.id} granted ${parsed.value.role} to ${baUserId}`
      )
      ctx.status = 201
      ctx.body = { data: await people().person(baUserId) }
    },

    // POST /grants/:documentId/revoke  { reason }
    async revokeGrant(ctx: any) {
      const admin = adminOf(ctx)
      if (!admin) return fail(ctx, 401, "Sign in to the admin first.")
      const { documentId } = (ctx.params ?? {}) as { documentId?: unknown }
      if (!isDocumentId(documentId)) return fail(ctx, 400, "Invalid grant id")
      const reason = parseRevokeReason(ctx.request?.body)
      if (!reason.ok) return fail(ctx, 400, reason.message)

      const result = await people().revoke(documentId, reason.value, admin.id)
      if (!result.ok)
        return result.error === "not_found"
          ? fail(ctx, 404, "Grant not found.")
          : fail(ctx, 409, "This grant has already ended.")
      strapi.log.info(
        `[content-moderation] admin:${admin.id} revoked grant ${documentId}`
      )
      ctx.body = {
        data: result.baUserId ? await people().person(result.baUserId) : null,
      }
    },
  }
}
