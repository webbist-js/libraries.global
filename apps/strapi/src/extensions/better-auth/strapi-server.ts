import { isIP } from "node:net"

import serviceAuth from "../../policies/service-auth"

/** The same-origin Next transport is the only public auth entry point. */
export default (plugin: any) => {
  const factory = plugin.controllers["auth-controller"]
  plugin.controllers["auth-controller"] = (...args: unknown[]) => {
    const controller = factory(...args)

    return {
      ...controller,
      async handleAuthRequest(ctx: any) {
        if (!serviceAuth(ctx))
          return ctx.unauthorized("Invalid authentication transport")
        const supplied = ctx.request.headers["x-auth-client-ip"]
        ctx.request.headers["x-auth-client-ip"] =
          typeof supplied === "string" && isIP(supplied)
            ? supplied
            : ctx.request.ip
        // The bridge credential is transport-only and never reaches auth hooks.
        delete ctx.request.headers["x-service-secret"]
        if (!String(ctx.params.path).startsWith("delete-user")) {
          await controller.handleAuthRequest(ctx)
          // Koa turns a null body into 204; Better Auth clients expect JSON null.
          if (
            ctx.params.path === "get-session" &&
            ctx.status === 204 &&
            ctx.body == null
          ) {
            ctx.body = "null"
            ctx.type = "application/json"
            ctx.status = 200
          }

          return
        }
        const rollback = Symbol("auth-delete-rollback")
        try {
          await strapi.db.transaction(async () => {
            await controller.handleAuthRequest(ctx)
            if (ctx.status >= 400) throw rollback
          })
        } catch (error) {
          if (error !== rollback) throw error
        }
      },
    }
  }

  return plugin
}
