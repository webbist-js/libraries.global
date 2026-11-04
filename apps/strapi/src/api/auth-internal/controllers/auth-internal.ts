import { fromNodeHeaders } from "better-auth/node"

import type { AuthRequestContext as Context } from "../../../auth/request-context"

export default {
  async providers(ctx: Context) {
    const auth = strapi.plugin("better-auth").service("auth-service").getAuth()
    ctx.body = {
      providers: Object.keys(auth.options.socialProviders ?? {}).filter(
        (provider) => ["google", "discord"].includes(provider)
      ),
    }
  },
  async verifyPassword(ctx: Context) {
    const password = ctx.request.body?.password
    if (typeof password !== "string" || !password || password.length > 1024)
      return ctx.badRequest("Invalid password")
    const auth = strapi.plugin("better-auth").service("auth-service").getAuth()
    try {
      ctx.body = await auth.api.verifyPassword({
        headers: fromNodeHeaders(ctx.request.headers),
        body: { password },
      })
      ctx.set("Cache-Control", "private, no-store")
    } catch {
      return ctx.unauthorized("Confirmation failed")
    }
  },
  async verifiedIdentities(ctx: Context) {
    const ids = ctx.request.body?.ids
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      !ids.every((id) => typeof id === "string" && /^[1-9]\d{0,9}$/.test(id))
    )
      return ctx.badRequest("Invalid identities")
    const rows = ids.length
      ? await strapi.db.query("plugin::better-auth.user").findMany({
          where: { id: { $in: ids.map(Number) }, emailVerified: true },
          select: ["id", "email"],
        })
      : []
    ctx.body = {
      data: rows.map((row) => ({ id: String(row.id), email: row.email })),
    }
    ctx.set("Cache-Control", "private, no-store")
  },
  async retention(ctx: Context) {
    const now = new Date()
    const sessions = await strapi.db
      .query("plugin::better-auth.session")
      .deleteMany({ where: { expiresAt: { $lt: now } } })
    const verifications = await strapi.db
      .query("plugin::better-auth.verification")
      .deleteMany({ where: { expiresAt: { $lt: now } } })
    const rateLimits = await strapi.db
      .query("plugin::better-auth.rate-limit")
      .deleteMany({
        where: { lastRequest: { $lt: now.getTime() - 30 * 86400000 } },
      })
    await strapi.db
      .connection("auth_activity_events")
      .where("created_at", "<", new Date(now.getTime() - 30 * 86400000))
      .delete()
    ctx.body = {
      sessions: sessions.count,
      verifications: verifications.count,
      rateLimits: rateLimits.count,
    }
  },
}
