import { StaffError } from "./service"
import { decodeHeaderName } from "../../../utils/header-name"
import { isValidServiceSecret } from "../../../utils/service-secret"

export default ({ strapi }: { strapi: any }) => {
  const wrap =
    (
      action: (
        service: any,
        ctx: any,
        user: { id: string; email: string; name: string }
      ) => Promise<unknown>,
      status = 200
    ) =>
    async (ctx: any) => {
      if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
        return ctx.unauthorized("Invalid service secret")
      const id = ctx.request.header["x-ba-user-id"]
      const email = ctx.request.header["x-ba-user-email"]
      if (typeof id !== "string" || !id || typeof email !== "string")
        return ctx.unauthorized("Missing identity")
      try {
        const body = await action(
          strapi.plugin("library-staff").service("staff"),
          ctx,
          {
            id,
            email,
            name: decodeHeaderName(ctx.request.header["x-ba-user-name"]) ?? "",
          }
        )
        ctx.status = status
        ctx.body = status === 204 ? null : (body ?? { ok: true })
        ctx.set("Cache-Control", "no-store")
      } catch (err) {
        if (!(err instanceof StaffError)) throw err
        ctx.status = err.status
        ctx.body = {
          error: { code: err.code },
          ...(err.status === 402
            ? { upgradeUrl: "/contribute/membership" }
            : {}),
        }
      }
    }

  return {
    overview: wrap((s, c, u) => s.overview(u.id, c.params.documentId)),
    team: wrap((s, c, u) => s.team(u.id, c.params.documentId)),
    member: wrap((s, c, u) =>
      s.changeMember(
        u.id,
        c.params.documentId,
        c.params.affiliationId,
        c.request.body ?? {}
      )
    ),
    remove: wrap(
      (s, c, u) =>
        s.changeMember(
          u.id,
          c.params.documentId,
          c.params.affiliationId,
          {},
          true
        ),
      204
    ),
    leave: wrap(
      (s, c, u) =>
        s.changeMember(u.id, c.params.documentId, "", {}, false, true),
      204
    ),
    report: wrap(
      (s, c, u) => s.report(u.id, c.params.documentId, c.request.body?.message),
      202
    ),
  }
}
