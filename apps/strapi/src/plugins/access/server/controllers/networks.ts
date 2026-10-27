import type { RecordInput } from "../../../../utils/document-store"
import { decodeHeaderName } from "../../../../utils/header-name"
import { isValidServiceSecret } from "../../../../utils/service-secret"
import type { NetworkUser } from "../services/network-records"
import type createNetworks from "../services/networks"
import { AccessError } from "../utils/admin"

type Context = {
  request: { header: Record<string, unknown>; body?: RecordInput }
  query: RecordInput
  params: { id: string }
  body: unknown
  status: number
  set: (key: string, value: string) => void
  unauthorized: (message: string) => unknown
}
type Runtime = {
  plugin: (name: string) => {
    service: (name: string) => ReturnType<typeof createNetworks>
  }
}
function wrap(
  work: (ctx: Context, user: NetworkUser) => Promise<unknown>,
  anonymous = false
) {
  return async (ctx: Context) => {
    ctx.set("Cache-Control", "no-store")
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    const id = ctx.request.header["x-ba-user-id"],
      email = ctx.request.header["x-ba-user-email"]
    if (!anonymous && (typeof id !== "string" || typeof email !== "string"))
      return ctx.unauthorized("Missing identity")
    try {
      ctx.body = await work(ctx, {
        id: typeof id === "string" ? id : "",
        email: typeof email === "string" ? email : "",
        name: decodeHeaderName(ctx.request.header["x-ba-user-name"]) ?? "",
      })
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = {
          error: { code: "invalid_network_input", message: error.message },
        }

        return
      }
      if (!(error instanceof AccessError)) throw error
      ctx.status = error.status
      ctx.body = { error: { code: error.code } }
    }
  }
}

export default ({ strapi }: { strapi: Runtime }) => {
  const service = () => strapi.plugin("access").service("networks")

  return {
    publicList: wrap((c) => service().catalogue(c.query), true),
    publicDetail: wrap((c) => service().detail(c.params.id, c.query), true),
    publicAffiliations: wrap(
      (c) => service().publicAffiliations(c.params.id),
      true
    ),
    catalogue: wrap((c) => service().catalogue(c.query, false)),
    detail: wrap((c) => service().detail(c.params.id, c.query, false)),
    scope: wrap((c) => service().scope(c.params.id)),
    target: wrap((c, u) => service().target(u.id, c.query)),
    mine: wrap((_, u) => service().mine(u.id)),
    staff: wrap((c, u) => service().staff(u.id, c.query)),
    affiliation: wrap((c, u) =>
      service().saveAffiliation(u.id, c.params.id, c.request.body ?? {})
    ),
    request: wrap((c, u) =>
      service().request(u, c.params.id, c.request.body ?? {})
    ),
    revokeAffiliation: wrap((c, u) =>
      service().revokeAffiliation(u.id, c.params.id, c.request.body ?? {})
    ),
    review: wrap((c, u) => service().review(u.id, c.params.id)),
    retry: wrap((c, u) => service().retry(u.id, c.params.id)),
    reconcile: wrap((c, u) =>
      service().reconcile(u.id, c.params.id, c.request.body ?? {})
    ),
  }
}
