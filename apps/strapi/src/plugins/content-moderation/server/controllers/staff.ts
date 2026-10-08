import { decodeHeaderName } from "../../../../utils/header-name"
import { isValidServiceSecret } from "../../../../utils/service-secret"
import { StaffSubmissionError, type StaffViewer } from "../services/staff"
import { isDocumentId } from "../utils/params"

export default ({ strapi }: { strapi: any }) => {
  const service = () => strapi.plugin("content-moderation").service("staff")
  const action =
    (fn: (ctx: any, viewer: StaffViewer) => Promise<unknown>) =>
    async (ctx: any) => {
      ctx.set?.("Cache-Control", "no-store")
      const h = ctx.request?.headers ?? {}
      if (
        !isValidServiceSecret(h["x-service-secret"]) ||
        typeof h["x-ba-user-id"] !== "string" ||
        typeof h["x-ba-user-email"] !== "string"
      ) {
        ctx.status = 401
        ctx.body = { error: { code: "unauthorized" } }

        return
      }
      if (!isDocumentId(ctx.params?.documentId)) {
        ctx.status = 400
        ctx.body = { error: { code: "invalid_id" } }

        return
      }
      try {
        ctx.body = await fn(ctx, {
          id: h["x-ba-user-id"],
          email: h["x-ba-user-email"],
          name: decodeHeaderName(h["x-ba-user-name"]),
        })
      } catch (e) {
        if (e instanceof StaffSubmissionError) {
          ctx.status = e.status
          ctx.body = {
            error: { code: e.code, message: e.message, ...e.detail },
          }

          return
        }
        if (
          e &&
          typeof e === "object" &&
          "status" in e &&
          "code" in e &&
          (e.status === 409 || e.status === 400)
        ) {
          ctx.status = e.status
          ctx.body = {
            error: {
              code: e.code,
              message:
                e instanceof Error
                  ? e.message
                  : "This change could not be applied.",
            },
          }

          return
        }
        throw e
      }
    }

  return {
    publish: action((ctx, user) =>
      service().publish(user, ctx.params.documentId, ctx.request.body)
    ),
    verify: action((ctx, user) =>
      service().verify(user, ctx.params.documentId, ctx.request.body)
    ),
    suggestions: action((ctx, user) =>
      service().suggestions(
        user,
        ctx.params.documentId,
        Math.min(500, Math.max(1, Math.trunc(Number(ctx.query?.page) || 1))),
        Math.min(20, Math.max(1, Math.trunc(Number(ctx.query?.pageSize) || 20)))
      )
    ),
    decision: action((ctx, user) =>
      service().decision(user, ctx.params.documentId, ctx.request.body)
    ),
  }
}
