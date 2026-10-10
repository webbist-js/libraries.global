import type { Core } from "@strapi/strapi"

import { isValidServiceSecret } from "../utils/service-secret"

/** The CMS origin accepts backend credentials, never the browser's beta pass. */
export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) =>
  async (ctx: any, next: () => Promise<unknown>) => {
    const path = decodeURIComponent(ctx.path ?? "")
      .toLowerCase()
      .replaceAll(/\/{2,}/g, "/")
    const prefix = String(
      strapi.config.get("api.rest.prefix", "/api")
    ).toLowerCase()
    if (
      process.env.BETA_GATE_ENABLED !== "true" ||
      !(path === prefix || path.startsWith(`${prefix}/`)) ||
      ctx.method === "OPTIONS"
    )
      return next()
    const headers = ctx.request?.headers ?? {}
    if (isValidServiceSecret(headers["x-service-secret"])) return next()
    const authorization = headers.authorization
    if (
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ") &&
      authorization.length <= 1024
    ) {
      const service = strapi.service("admin::api-token-content-api") as any
      const token = await service.getByAccessKey(
        service.hash(authorization.slice(7))
      )
      if (
        token &&
        (token.kind == null || token.kind === "content-api") &&
        (!token.expiresAt || new Date(token.expiresAt).getTime() > Date.now())
      )
        return next()
    }
    ctx.status = 401
    ctx.set("Cache-Control", "no-store")
    ctx.body = {
      error: {
        status: 401,
        name: "UnauthorizedError",
        message: "Beta access requires the application",
      },
    }
  }
