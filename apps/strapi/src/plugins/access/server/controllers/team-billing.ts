import type { Core } from "@strapi/strapi"

import { isValidServiceSecret } from "../../../../utils/service-secret"
import { AccessError } from "../utils/admin"

type BridgeContext = {
  request: { header: Record<string, unknown>; body: unknown }
  unauthorized: () => unknown
  set: (name: string, value: string) => void
  body: unknown
  status: number
}

export default ({ strapi }: { strapi: Core.Strapi }) =>
  Object.fromEntries(
    ["create", "context", "sync", "deletionCheck", "discard"].map((action) => [
      action,
      async (ctx: BridgeContext) => {
        if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
          return ctx.unauthorized()
        ctx.set("Cache-Control", "no-store")
        try {
          ctx.body = await strapi
            .plugin("access")
            .service("team-billing")
            [action](ctx.request.body)
        } catch (error) {
          if (!(error instanceof AccessError)) throw error
          ctx.status = error.status
          ctx.body = { error: { code: error.code } }
        }
      },
    ])
  )
