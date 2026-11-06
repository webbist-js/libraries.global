import type { Core } from "@strapi/strapi"

import { isValidServiceSecret } from "../../../../utils/service-secret"
import { AccessError } from "../utils/admin"

type BridgeContext = {
  request: { header: Record<string, unknown>; body: unknown }
  params: Record<string, string>
  unauthorized: () => unknown
  set: (name: string, value: string) => void
  body: unknown
  status: number
}

/**
 * Service-secret routes for the application's API account billing. They
 * never trust a browser identity: the application authenticates the user and
 * passes only the fields each operation needs.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = () => strapi.plugin("access").service("api-accounts")
  const wrap =
    (work: (ctx: BridgeContext) => Promise<unknown>) =>
    async (ctx: BridgeContext) => {
      if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
        return ctx.unauthorized()
      ctx.set("Cache-Control", "no-store")
      try {
        ctx.body = await work(ctx)
      } catch (error) {
        if (!(error instanceof AccessError)) throw error
        ctx.status = error.status
        ctx.body = { error: { code: error.code } }
      }
    }

  return {
    organisation: wrap((ctx) =>
      service().createOrganisation(ctx.request.body as never)
    ),
    ownerCheck: wrap((ctx) => service().ownerCheck(ctx.request.body as never)),
    notice: wrap((ctx) =>
      service().notice(ctx.params.id, ctx.request.body as never)
    ),
  }
}
