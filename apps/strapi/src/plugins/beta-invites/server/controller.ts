import { betaInvitationEmail } from "@repo/shared-data"

import { InviteError } from "./service"
import { isValidServiceSecret } from "../../../utils/service-secret"

const ID = /^[a-z0-9]{20,32}$/
const STATUSES = new Set([
  "waiting",
  "queued",
  "sent",
  "accepted",
  "failed",
  "expired",
  "revoked",
  "unavailable",
])

export default ({ strapi }: { strapi: any }) => {
  const service = () => strapi.plugin("beta-invites").service("invites")
  const protectedAction =
    (work: (ctx: any) => Promise<unknown>) => async (ctx: any) => {
      ctx.set("Cache-Control", "private, no-store")
      try {
        return await work(ctx)
      } catch (error) {
        if (error instanceof InviteError) {
          ctx.status = error.status
          ctx.body = { error: { status: error.status, message: error.message } }

          return
        }
        throw error
      }
    }
  const actor = (ctx: any) => {
    const id = ctx.state?.user?.id
    if (typeof id !== "string" && typeof id !== "number")
      throw new InviteError(401, "Sign in to Strapi first.")

    return String(id)
  }
  const subscriberId = (ctx: any) => {
    if (!ID.test(ctx.params?.id ?? ""))
      throw new InviteError(400, "Invalid subscriber.")

    return ctx.params.id
  }
  const bridge = (ctx: any) => {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      throw new InviteError(401, "Unauthorized")
  }

  return {
    list: protectedAction(async (ctx) => {
      const { q = "", locale = "", status = "", page = "1" } = ctx.query
      if (
        typeof q !== "string" ||
        q.length > 100 ||
        !["", "en", "cs", "fr"].includes(locale) ||
        (status !== "" && !STATUSES.has(status)) ||
        typeof page !== "string" ||
        !/^\d{1,5}$/.test(page)
      )
        throw new InviteError(400, "Invalid filters.")
      ctx.body = await service().list({
        q: q.trim(),
        locale,
        status,
        page: Math.max(1, Math.min(10000, Number(page))),
      })
    }),
    history: protectedAction(async (ctx) => {
      ctx.body = { data: await service().history(subscriberId(ctx)) }
    }),
    preview: protectedAction(async (ctx) => {
      const locale = ctx.query.locale ?? "en"
      if (!["en", "cs", "fr"].includes(locale))
        throw new InviteError(400, "Invalid language.")
      ctx.body = betaInvitationEmail({
        locale,
        code: "EXAMPLE-CODE-FOR-PREVIEW-ONLY",
        siteUrl: process.env.APP_PUBLIC_URL || "https://libraries.global",
      })
    }),
    send: protectedAction(async (ctx) => {
      ctx.body = await service().issue(subscriberId(ctx), actor(ctx), false)
    }),
    resend: protectedAction(async (ctx) => {
      ctx.body = await service().issue(subscriberId(ctx), actor(ctx), true)
    }),
    revoke: protectedAction(async (ctx) => {
      await service().revoke(subscriberId(ctx), actor(ctx))
      ctx.body = { ok: true }
    }),
    retry: protectedAction(async (ctx) => {
      actor(ctx)
      await service().retry(subscriberId(ctx))
      ctx.body = { ok: true }
    }),
    redeem: protectedAction(async (ctx) => {
      bridge(ctx)
      const result = await service().redeem(ctx.request.body?.code)
      if (!result)
        throw new InviteError(401, "This invitation is invalid or has ended.")
      ctx.body = result
    }),
    validate: protectedAction(async (ctx) => {
      bridge(ctx)
      const id = ctx.request.body?.invitationId
      ctx.body = {
        valid:
          typeof id === "string" &&
          ID.test(id) &&
          (await service().validate(id)),
      }
    }),
  }
}
