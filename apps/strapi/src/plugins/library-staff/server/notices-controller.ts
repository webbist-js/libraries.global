import { NoticeError } from "../../../utils/library-notices"
import { isValidServiceSecret } from "../../../utils/service-secret"
import { isDocumentId } from "../../content-moderation/server/utils/params"

export default ({ strapi }: { strapi: any }) => {
  const service = () => strapi.plugin("library-staff").service("notices")
  const wrap =
    (fn: (ctx: any, id: string, userId: string) => Promise<unknown>) =>
    async (ctx: any) => {
      const headers = ctx.request?.headers ?? {},
        userId = headers["x-ba-user-id"],
        id = ctx.params?.documentId
      ctx.set?.("Cache-Control", "no-store")
      if (
        !isValidServiceSecret(headers["x-service-secret"]) ||
        typeof userId !== "string"
      ) {
        ctx.status = 401
        ctx.body = { error: { code: "unauthorized" } }

        return
      }
      if (
        !isDocumentId(id) ||
        (ctx.params?.noticeId && !isDocumentId(ctx.params.noticeId))
      ) {
        ctx.status = 400
        ctx.body = { error: { code: "invalid_id" } }

        return
      }
      try {
        ctx.body = await fn(ctx, id, userId)
      } catch (e) {
        if (!(e instanceof NoticeError)) throw e
        ctx.status = e.status
        ctx.body = { error: { code: e.code, message: e.message } }
      }
    }

  return {
    list: wrap((ctx, id, userId) => service().list(userId, id)),
    create: wrap((ctx, id, userId) =>
      service().createNotice({
        ...ctx.request.body,
        libraryDocumentId: id,
        baUserId: userId,
        source: "staff",
      })
    ),
    edit: wrap((ctx, id, userId) =>
      service().edit(userId, id, ctx.params.noticeId, ctx.request.body)
    ),
    end: wrap((ctx, id, userId) =>
      service().end(userId, id, ctx.params.noticeId)
    ),
  }
}
