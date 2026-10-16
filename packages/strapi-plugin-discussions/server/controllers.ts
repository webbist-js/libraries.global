import { open, stat } from "node:fs/promises"

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

  const image = async (ctx: any, actor: any) => {
    const media = await service().image(actor, id(ctx.params.id))
    ctx.set("Content-Type", media.mime)
    ctx.set("X-Content-Type-Options", "nosniff")
    ctx.set("Content-Disposition", "inline")

    return Buffer.from(media.bytes)
  }

  return {
    image: endpoint(image),
    adminImage: endpoint(image, true),
    uploadImage: endpoint(async (ctx, actor) => {
      if (!actor) fail(401, "Authentication required")
      if (ctx.state.discussionsUpload)
        return service().uploadImage(
          actor,
          ctx.state.discussionsUpload.fields,
          ctx.state.discussionsUpload.bytes
        )
      if (
        Object.keys(ctx.request.body ?? {}).some(
          (key) => !["subjectId", "altText", "caption"].includes(key)
        )
      )
        fail(400, "Invalid image fields")
      if (Object.keys(ctx.request.files ?? {}).some((key) => key !== "file"))
        fail(400, "Use the file image field")
      if (
        !String(ctx.request.headers["content-type"] ?? "").startsWith(
          "multipart/form-data"
        )
      )
        fail(415, "Multipart image upload required")
      const files = Object.values(ctx.request.files ?? {}).flat() as any[]
      if (files.length !== 1) fail(400, "Upload one discussion image")
      const file = files[0],
        max = { ...defaults, ...strapi.config.get("plugin::discussions", {}) }
          .maxImageBytes
      if (
        !(file?.filepath || file?.path) ||
        (await stat(file.filepath ?? file.path)).size > max
      )
        fail(413, "Discussion image exceeds size limit")
      const handle = await open(file.filepath ?? file.path, "r")
      try {
        const buffer = Buffer.alloc(max + 1),
          { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
        if (bytesRead > max) fail(413, "Discussion image exceeds size limit")

        return service().uploadImage(
          actor,
          ctx.request.body,
          buffer.subarray(0, bytesRead)
        )
      } finally {
        await handle.close()
      }
    }),
    sanctions: endpoint((ctx, actor) => service().sanctions(actor, ctx.query)),
    liftSanction: endpoint((ctx, actor) =>
      service().liftSanction(actor, id(ctx.params.id), ctx.request.body)
    ),
    adminSanctions: endpoint(
      (ctx, actor) => service().sanctions(actor, ctx.query),
      true
    ),
    adminLiftSanction: endpoint(
      (ctx, actor) =>
        service().liftSanction(actor, id(ctx.params.id), ctx.request.body),
      true
    ),
    myStatus: endpoint((_ctx, actor) => service().myStatus(actor)),
    appealSanction: endpoint((ctx, actor) =>
      service().appealSanction(actor, id(ctx.params.id), ctx.request.body)
    ),
    react: endpoint((ctx, actor) =>
      service().react(
        actor,
        kinds(ctx.params.kind),
        id(ctx.params.id),
        ctx.request.body
      )
    ),
    sanctionRecord: endpoint((ctx, actor) =>
      service().sanctionRecord(
        actor,
        kinds(ctx.params.kind),
        id(ctx.params.id),
        ctx.request.body
      )
    ),
    adminSanctionRecord: endpoint(
      (ctx, actor) =>
        service().sanctionRecord(
          actor,
          kinds(ctx.params.kind),
          id(ctx.params.id),
          ctx.request.body
        ),
      true
    ),
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
