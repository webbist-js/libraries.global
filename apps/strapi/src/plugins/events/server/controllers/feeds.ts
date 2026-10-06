import { EVENT_PROVIDERS } from "@repo/shared-data"

import { decodeHeaderName } from "../../../../utils/header-name"
import { isValidServiceSecret } from "../utils/service-secret"

const DOC_ID = /^[a-z0-9]{20,32}$/

/**
 * Event Feeds for the site (`/api/events/feeds*`). Every route is
 * `auth: false` and needs the bridge secret plus `X-Ba-User-Id`; the
 * user's claims are re-read by the service on every call. Values are never
 * echoed back.
 */
export default ({ strapi }: { strapi: any }) => {
  const feeds = () => strapi.plugin("events").service("feeds")
  const oauth = () => strapi.plugin("events").service("feedOauth")

  function userOf(ctx: any) {
    const h = ctx.request?.headers ?? {}
    if (!isValidServiceSecret(h["x-service-secret"])) return null
    const id =
      typeof h["x-ba-user-id"] === "string" ? h["x-ba-user-id"].trim() : ""
    if (!id) return null

    return {
      id,
      email:
        typeof h["x-ba-user-email"] === "string" ? h["x-ba-user-email"] : null,
      name: decodeHeaderName(
        typeof h["x-ba-user-name"] === "string" ? h["x-ba-user-name"] : null
      ),
    }
  }

  async function run(
    ctx: any,
    fn: (user: any) => Promise<any>,
    opts: { docId?: boolean } = {}
  ) {
    ctx.set?.("Cache-Control", "no-store")
    const user = userOf(ctx)
    if (!user) {
      ctx.status = 401
      ctx.body = {
        error: {
          status: 401,
          name: "unauthorised",
          message: "Service secret and user required.",
        },
      }

      return
    }
    if (opts.docId && !DOC_ID.test(String(ctx.params?.documentId ?? ""))) {
      ctx.status = 400
      ctx.body = {
        error: { status: 400, name: "invalid_id", message: "Invalid feed id." },
      }

      return
    }
    const out = await fn(user)
    if (out && typeof out === "object" && "error" in out) {
      ctx.status = out.error.status
      ctx.body = out

      return
    }
    ctx.body = { data: out }
  }

  const body = (ctx: any) =>
    (ctx.request?.body ?? {}) as Record<string, unknown>

  return {
    list: (ctx: any) => run(ctx, (u) => feeds().list(u)),
    providers: (ctx: any) =>
      run(ctx, async () => ({
        providers: Object.values(EVENT_PROVIDERS),
        oauth: {
          eventbrite: !!(
            process.env.EVENTBRITE_CLIENT_ID &&
            process.env.EVENTBRITE_CLIENT_SECRET
          ),
        },
      })),
    testValues: (ctx: any) =>
      run(ctx, (u) =>
        feeds().testValues(u, {
          libraryDocumentId: String(body(ctx).libraryDocumentId ?? ""),
          provider: String(body(ctx).provider ?? ""),
          values: body(ctx).values,
        })
      ),
    connect: (ctx: any) =>
      run(ctx, (u) =>
        feeds().connect(u, {
          libraryDocumentId: String(body(ctx).libraryDocumentId ?? ""),
          provider: String(body(ctx).provider ?? ""),
          values: body(ctx).values,
        })
      ),
    oauthEventbrite: (ctx: any) =>
      run(ctx, (u) =>
        oauth().exchangeEventbrite(u, {
          code: String(body(ctx).code ?? ""),
          libraryDocumentId: String(body(ctx).libraryDocumentId ?? ""),
        })
      ),
    organization: (ctx: any) =>
      run(
        ctx,
        (u) =>
          oauth().completeEventbrite(
            u,
            ctx.params.documentId,
            String(body(ctx).organizationId ?? "")
          ),
        { docId: true }
      ),
    replace: (ctx: any) =>
      run(
        ctx,
        (u) =>
          feeds().replace(u, ctx.params.documentId, {
            values: body(ctx).values,
          }),
        { docId: true }
      ),
    testCurrent: (ctx: any) =>
      run(ctx, (u) => feeds().testCurrent(u, ctx.params.documentId), {
        docId: true,
      }),
    pause: (ctx: any) =>
      run(ctx, (u) => feeds().pause(u, ctx.params.documentId), { docId: true }),
    resume: (ctx: any) =>
      run(ctx, (u) => feeds().resume(u, ctx.params.documentId), {
        docId: true,
      }),
    withdrawPending: (ctx: any) =>
      run(ctx, (u) => feeds().withdrawPending(u, ctx.params.documentId), {
        docId: true,
      }),
    disconnect: (ctx: any) =>
      run(ctx, (u) => feeds().disconnect(u, ctx.params.documentId), {
        docId: true,
      }),
  }
}
