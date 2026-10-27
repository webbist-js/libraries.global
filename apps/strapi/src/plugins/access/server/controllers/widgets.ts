import { isValidServiceSecret } from "../../../../utils/service-secret"
import type { WidgetInput } from "../services/widget-records"
import type createWidgets from "../services/widgets"
import { AccessError } from "../utils/admin"

type WidgetService = ReturnType<typeof createWidgets>
type Runtime = {
  plugin: (name: string) => { service: (name: string) => WidgetService }
}
type Context = {
  request: { header: Record<string, unknown>; body?: WidgetInput }
  params: {
    id: string
    widgetId: string
    action: string
    selectionId: string
    publicId: string
  }
  query: WidgetInput
  body: unknown
  status: number
  set: (name: string, value: string) => void
  unauthorized: (message: string) => unknown
}
function wrap(
  work: (ctx: Context, userId: string) => Promise<unknown>,
  anonymous = false
) {
  return async (ctx: Context) => {
    ctx.set("Cache-Control", "no-store")
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    const header = ctx.request.header["x-ba-user-id"]
    const userId = typeof header === "string" ? header : ""
    if (!anonymous && !userId) return ctx.unauthorized("Missing identity")
    try {
      ctx.body = await work(ctx, userId)
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = {
          error: { code: "invalid_widget_input", message: error.message },
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
  const service = () => strapi.plugin("access").service("widgets")
  const call = (action: "create" | "preview" | "primaryNetwork") =>
    wrap((ctx, u) =>
      service()[action](ctx.params.id, u, ctx.request.body ?? {})
    )

  return {
    workspace: wrap((c, u) => service().workspace(c.params.id, u)),
    detail: wrap((c, u) => service().detail(c.params.id, u, c.params.widgetId)),
    create: call("create"),
    preview: call("preview"),
    primaryNetwork: call("primaryNetwork"),
    save: wrap((c, u) =>
      service().save(c.params.id, u, c.params.widgetId, c.request.body ?? {})
    ),
    action: wrap((c, u) =>
      service().action(
        c.params.id,
        u,
        c.params.widgetId,
        c.params.action,
        c.request.body ?? {}
      )
    ),
    selection: wrap((c, u) =>
      service().saveSelection(
        c.params.id,
        u,
        c.request.body ?? {},
        c.params.selectionId
      )
    ),
    catalogue: wrap((c, u) => service().catalogue(c.params.id, u, c.query)),
    accessLibraries: wrap((c, u) => service().accessLibraries(c.params.id, u)),
    data: wrap(
      (c) => service().public(c.params.publicId, c.query.count === "true"),
      true
    ),
    policy: wrap((c) => service().policy(c.params.publicId), true),
    report: wrap(async (c) => {
      await service().policy(c.params.publicId, true)

      return { ok: true }
    }, true),
  }
}
