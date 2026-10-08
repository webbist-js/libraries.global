import { StaffError } from "./service"
import { isValidServiceSecret } from "../../../utils/service-secret"

/**
 * `GET /libraries/:documentId/drawer`: the staff drawer's summary. Bridge
 * secret plus the Better Auth identity headers, like the other staff
 * routes; the service re-checks staff membership.
 */
export default ({ strapi }: { strapi: any }) => ({
  async get(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    const id = ctx.request.header["x-ba-user-id"]
    if (typeof id !== "string" || !id)
      return ctx.unauthorized("Missing identity")
    try {
      ctx.body = await strapi
        .plugin("library-staff")
        .service("drawer")
        .get(id, ctx.params.documentId)
      ctx.set("Cache-Control", "no-store")
    } catch (err) {
      if (!(err instanceof StaffError)) throw err
      ctx.status = err.status
      ctx.body = { error: { code: err.code } }
    }
  },
})
