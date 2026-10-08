import {
  AccessError,
  adminOf,
  fail,
  isDocumentId,
  parseExpiry,
  parseReason,
} from "../utils/admin"

/**
 * The Plans page (admin routes, `plugin::access.manage-plans`): plan
 * grants and Pro verifications. The admin is always `ctx.state.user`.
 */

export default ({ strapi }: { strapi: any }) => {
  const plans = () => strapi.plugin("access").service("plans")

  const run =
    (
      work: (ctx: any, admin: { id: string | number }) => Promise<unknown>,
      status = 200
    ) =>
    async (ctx: any) => {
      const admin = adminOf(ctx)
      if (!admin) return fail(ctx, 401, "Sign in to the admin first.")
      ctx.set?.("Cache-Control", "no-store")
      try {
        const body = await work(ctx, admin)
        ctx.status = status
        ctx.body = status === 204 ? null : { data: body ?? null }
      } catch (err) {
        if (!(err instanceof AccessError)) throw err
        fail(ctx, err.status, err.message, { code: err.code })
      }
    }

  const query = (ctx: any): string => {
    const q = ctx.query?.q
    if (q !== undefined && typeof q !== "string")
      throw new AccessError(400, "invalid_query", "q must be text")
    if (typeof q === "string" && q.length > 254)
      throw new AccessError(
        400,
        "invalid_query",
        "q is limited to 254 characters"
      )

    return q ?? ""
  }
  const id = (ctx: any): string => {
    const v = ctx.params?.documentId
    if (!isDocumentId(v)) throw new AccessError(400, "invalid_id", "Invalid id")

    return v
  }

  return {
    // GET /plans/grants?q=
    listGrants: run((ctx) => plans().listGrants(query(ctx))),

    // POST /plans/grants  { person, plan, source?, reason, expiresAt? }
    createGrant: run(async (ctx, admin) => {
      const b = ctx.request?.body ?? {}
      const reason = parseReason(b.reason, "granting")
      if (!reason.ok)
        throw new AccessError(400, "invalid_reason", reason.message)
      const expiry = parseExpiry(b.expiresAt)
      if (!expiry.ok)
        throw new AccessError(400, "invalid_expiry", expiry.message)

      return plans().createGrant(
        {
          person: b.person,
          plan: b.plan,
          source: b.source,
          reason: reason.value,
          expiresAt: expiry.value,
        },
        admin.id
      )
    }, 201),

    // POST /plans/grants/:documentId/revoke  { reason }
    revokeGrant: run(async (ctx, admin) => {
      const reason = parseReason(ctx.request?.body?.reason, "revoking")
      if (!reason.ok)
        throw new AccessError(400, "invalid_reason", reason.message)
      await plans().revokeGrant(id(ctx), reason.value, admin.id)
    }, 204),

    // GET /plans/verifications?q=
    listVerifications: run((ctx) => plans().listVerifications(query(ctx))),

    // POST /plans/verifications  { person, kind, verifiedEmail?, expiresAt? }
    createVerification: run(async (ctx, admin) => {
      const b = ctx.request?.body ?? {}
      const expiry = parseExpiry(b.expiresAt)
      if (!expiry.ok)
        throw new AccessError(400, "invalid_expiry", expiry.message)

      return plans().createVerification(
        {
          person: b.person,
          kind: b.kind,
          verifiedEmail: b.verifiedEmail,
          expiresAt: expiry.value,
        },
        admin.id
      )
    }, 201),

    // POST /plans/verifications/:documentId/revoke  { reason }
    revokeVerification: run(async (ctx, admin) => {
      const reason = parseReason(ctx.request?.body?.reason, "revoking")
      if (!reason.ok)
        throw new AccessError(400, "invalid_reason", reason.message)
      await plans().revokeVerification(id(ctx), reason.value, admin.id)
    }, 204),
  }
}
