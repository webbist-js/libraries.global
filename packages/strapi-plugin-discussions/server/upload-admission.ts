import { defaults } from "./config"
import { resolveActor } from "./identity"
import { DiscussionError, fail } from "./validation"

/** Route-specific guard before Strapi's global multipart parser; never writes raw private files. */
export function attachmentAdmission(strapi: any) {
  const prefix = strapi.config.get("api.rest.prefix", "/api").replace(/\/$/, "")

  return async (ctx: any, next: () => Promise<void>) => {
    if (
      ctx.method !== "POST" ||
      ![
        `${prefix}/discussions/attachments`,
        `${prefix}/discussions/attachments/`,
      ].includes(ctx.path)
    )
      return next()
    const config = {
      ...defaults,
      ...strapi.config.get("plugin::discussions", {}),
    }
    const contentType = String(ctx.request.headers["content-type"] ?? "")
    const maxTransportBytes = config.maxImageBytes + 16 * 1024
    ctx.set("Cache-Control", "private, no-store")
    try {
      const actor = await resolveActor(strapi, config, ctx)
      await strapi
        .plugin("discussions")
        .service("discussion")
        .imageAdmission(actor)
      if (!contentType.startsWith("multipart/form-data"))
        fail(415, "Multipart image upload required")
      const length = ctx.request.headers["content-length"]
      if (
        length !== undefined &&
        (!/^\d+$/.test(String(length)) || Number(length) > maxTransportBytes)
      )
        fail(413, "Discussion image exceeds size limit")
      const chunks: Buffer[] = []
      let size = 0
      // Avoid destroying the socket before sending a useful 413; close it after the response.
      for await (const chunk of ctx.req.iterator({ destroyOnReturn: false })) {
        size += chunk.length
        if (size > maxTransportBytes)
          fail(413, "Discussion image exceeds size limit")
        chunks.push(Buffer.from(chunk))
      }
      let form: FormData
      try {
        form = await new Request("http://discussions.invalid/attachments", {
          method: "POST",
          headers: { "content-type": contentType },
          body: Buffer.concat(chunks),
        }).formData()
      } catch {
        return fail(400, "Invalid multipart image")
      }
      const entries = [...form.entries()]
      if (
        entries.some(
          ([key]) => !["file", "subjectId", "altText", "caption"].includes(key)
        ) ||
        new Set(entries.map(([key]) => key)).size !== entries.length
      )
        fail(400, "Invalid image fields")
      const file = form.get("file")
      if (!(file instanceof Blob))
        return fail(400, "Upload one discussion image")
      if (file.size > config.maxImageBytes)
        return fail(413, "Discussion image exceeds size limit")
      const fields: Record<string, string> = {}
      for (const key of ["subjectId", "altText", "caption"]) {
        const value = form.get(key)
        if (value !== null && typeof value !== "string")
          fail(400, "Invalid image fields")
        if (typeof value === "string") fields[key] = value
      }
      ctx.state.discussionsUpload = {
        fields,
        bytes: Buffer.from(await file.arrayBuffer()),
      }
      // This one request was already parsed with a hard stream ceiling. Unknown media types
      // are skipped by koa-body; security/CORS, route authorization and error middleware still run.
      ctx.request.headers["content-type"] = "application/octet-stream"
      try {
        await next()
      } finally {
        ctx.request.headers["content-type"] = contentType
        delete ctx.state.discussionsUpload
      }
    } catch (error: any) {
      if (!(error instanceof DiscussionError)) throw error
      ctx.status = error.status
      ctx.body = { error: { status: error.status, message: error.message } }
      ctx.set("Connection", "close")
      ctx.res.once("finish", () => ctx.req.destroy())
    }
  }
}
