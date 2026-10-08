import { LiveError } from "./service"
import { isValidServiceSecret } from "../../../utils/service-secret"

export default ({ strapi }: { strapi: any }) => {
  const wrap =
    (
      action: (s: any, c: any, id: string) => Promise<unknown>,
      publicRead = false
    ) =>
    async (ctx: any) => {
      if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
        return ctx.unauthorized("Invalid service secret")
      const id = ctx.request.header["x-ba-user-id"]
      if (!publicRead && (typeof id !== "string" || !id))
        return ctx.unauthorized("Missing identity")
      try {
        ctx.body = await action(
          strapi.plugin("mobile-libraries").service("live"),
          ctx,
          id
        )
        ctx.set("Cache-Control", "no-store")
      } catch (e) {
        if (!(e instanceof LiveError)) throw e
        ctx.status = e.status
        ctx.body = { error: { code: e.code } }
      }
    }
  const proof = (c: any) => c.request.header["x-live-proof"]
  const session = (c: any) => c.request.header["x-ba-session-id"]
  const token = (c: any) => c.request.header["x-live-token"]

  return {
    public: wrap((s, c) => {
      const ids = typeof c.query.ids === "string" ? c.query.ids.split(",") : []
      if (
        !ids.length ||
        ids.length > 50 ||
        ids.some((id: string) => !/^[a-z0-9]{20,32}$/i.test(id))
      )
        throw new LiveError(400, "invalid_ids")

      return s.public([...new Set(ids)])
    }, true),
    settings: wrap((s, c, u) => s.settings(u, c.params.documentId)),
    updateSettings: wrap((s, c, u) =>
      s.updateSettings(u, c.params.documentId, c.request.body ?? {})
    ),
    start: wrap((s, c, u) =>
      s.start(u, c.request.body ?? {}, proof(c), session(c))
    ),
    takeover: wrap((s, c, u) =>
      s.start(u, c.request.body ?? {}, proof(c), session(c), true)
    ),
    resume: wrap((s, c, u) =>
      s.resume(u, c.params.sessionId, token(c), proof(c), session(c))
    ),
    events: wrap((s, c, u) =>
      s.append(
        u,
        c.params.sessionId,
        token(c),
        c.request.body ?? {},
        proof(c),
        session(c)
      )
    ),
    position: wrap((s, c, u) =>
      s.position(
        u,
        c.params.sessionId,
        token(c),
        c.request.body ?? {},
        proof(c),
        session(c)
      )
    ),
    end: wrap((s, c, u) => s.end(u, c.params.sessionId, token(c))),
    log: wrap((s, c, u) => s.log(u, c.params.documentId)),
    link: wrap((s, c, u) =>
      s.emailLink(
        u,
        c.params.documentId,
        c.request.header["x-ba-user-email"],
        c.request.body?.locale
      )
    ),
    locked: wrap((s, _c, u) => s.locked(u)),
  }
}
