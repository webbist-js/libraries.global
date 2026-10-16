import { defaults } from "./config"
import { resolveActor } from "./identity"
import { DiscussionError, fail, id, object } from "./validation"

const kinds = (value: unknown): "thread" | "reply" =>
  value === "thread" || value === "reply"
    ? value
    : fail(400, "Invalid record type")

export default function controllers({ strapi }: { strapi: any }) {
  const service = () => strapi.plugin("discussions").service("discussion")
  function endpoint(fn: (ctx: any, actor: any) => Promise<any>, admin = false) {
    return async (ctx: any) => {
      ctx.set?.("Cache-Control", "private, no-store")
      try {
        const actor = admin
          ? {
              key: `admin:${ctx.state.user.id}`,
              name: ctx.state.user.firstname || "Administrator",
              admin: true,
            }
          : await resolveActor(
              strapi,
              { ...defaults, ...strapi.config.get("plugin::discussions", {}) },
              ctx
            )
        ctx.body = await fn(ctx, actor)
      } catch (error: any) {
        if (error instanceof DiscussionError) {
          ctx.status = error.status
          ctx.body = { error: { status: error.status, message: error.message } }

          return
        }
        // Uniqueness handles races between different subjects attaching the same target.
        if (
          ["23505", "SQLITE_CONSTRAINT_UNIQUE", "ER_DUP_ENTRY"].includes(
            error?.code
          )
        ) {
          ctx.status = 409
          ctx.body = {
            error: { status: 409, message: "Discussion record already exists" },
          }

          return
        }
        throw error
      }
    }
  }
  const revision = (ctx: any, actor: any) =>
    service().review(actor, id(ctx.params.id), ctx.request.body)
  const moderate = (ctx: any, actor: any) =>
    service().moderate(
      actor,
      kinds(ctx.params.kind),
      id(ctx.params.id),
      ctx.request.body
    )
  const reportDecision = (ctx: any, actor: any) =>
    service().decideReport(actor, id(ctx.params.id), ctx.request.body)

  return {
    subjects: endpoint((ctx, actor) =>
      service().listSubjects(actor, ctx.query)
    ),
    threads: endpoint((ctx, actor) => service().listThreads(actor, ctx.query)),
    thread: endpoint((ctx, actor) =>
      service().getThread(actor, id(ctx.params.id))
    ),
    createThread: endpoint((ctx, actor) =>
      service().createThread(actor, ctx.request.body)
    ),
    replies: endpoint((ctx, actor) =>
      service().listReplies(actor, id(ctx.params.id), ctx.query)
    ),
    createReply: endpoint((ctx, actor) =>
      service().createReply(actor, id(ctx.params.id), ctx.request.body)
    ),
    edit: endpoint((ctx, actor) =>
      service().edit(
        actor,
        kinds(ctx.params.kind),
        id(ctx.params.id),
        ctx.request.body
      )
    ),
    revisions: endpoint((ctx, actor) =>
      service().revisions(
        actor,
        kinds(ctx.params.kind),
        id(ctx.params.id),
        ctx.query
      )
    ),
    report: endpoint((ctx, actor) =>
      service().report(
        actor,
        kinds(ctx.params.kind),
        id(ctx.params.id),
        ctx.request.body
      )
    ),
    subscribe: endpoint((ctx, actor) =>
      service().subscribe(
        actor,
        id(ctx.params.id),
        object(ctx.request.body).enabled
      )
    ),
    myRecords: endpoint((ctx, actor) =>
      service().myRecords(actor, kinds(ctx.query.kind ?? "thread"), ctx.query)
    ),
    queue: endpoint((ctx, actor) => service().reviewQueue(actor, ctx.query)),
    review: endpoint(revision),
    moderate: endpoint(moderate),
    reports: endpoint((ctx, actor) => service().reports(actor, ctx.query)),
    decideReport: endpoint(reportDecision),
    audit: endpoint((ctx, actor) =>
      service().auditLog(actor, id(ctx.params.id), ctx.query)
    ),
    adminThreads: endpoint(
      (ctx, actor) => service().adminThreads(actor, ctx.query),
      true
    ),
    adminSubjects: endpoint(
      (ctx, actor) => service().listSubjects(actor, ctx.query),
      true
    ),
    adminSaveSubject: endpoint(
      (ctx, actor) =>
        service().saveSubject(
          actor,
          ctx.request.body,
          ctx.params.id ? id(ctx.params.id) : undefined
        ),
      true
    ),
    adminQueue: endpoint(
      (ctx, actor) => service().reviewQueue(actor, ctx.query),
      true
    ),
    adminReview: endpoint(revision, true),
    adminModerate: endpoint(moderate, true),
    adminReports: endpoint(
      (ctx, actor) => service().reports(actor, ctx.query),
      true
    ),
    adminDecideReport: endpoint(reportDecision, true),
    adminAudit: endpoint(
      (ctx, actor) => service().auditLog(actor, id(ctx.params.id), ctx.query),
      true
    ),
  }
}
