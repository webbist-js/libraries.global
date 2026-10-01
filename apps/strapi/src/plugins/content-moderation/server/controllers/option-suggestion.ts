import { resolveUser } from "./submission"
import {
  decideSuggestion,
  listSuggestions,
  toggleVote,
} from "../utils/option-suggestions"
import { isDocumentId } from "../utils/params"

/**
 * Validates a decision body and applies it: shared by the admin route and
 * the editorial board's content-api route, which differ only in who
 * `decidedBy` names.
 */
export async function decideFromRequest(
  strapi: any,
  id: unknown,
  body: unknown,
  decidedBy: string
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 404; message: string }
> {
  const { decision, name, note } = (body ?? {}) as {
    decision?: unknown
    name?: unknown
    note?: unknown
  }
  if (!isDocumentId(id))
    return { ok: false, status: 400, message: "Invalid id" }
  if (decision !== "accept" && decision !== "decline")
    return {
      ok: false,
      status: 400,
      message: "decision must be accept or decline",
    }
  const updated = await decideSuggestion(strapi, {
    documentId: id,
    decision,
    decidedBy,
    name: typeof name === "string" ? name : undefined,
    note: typeof note === "string" ? note : undefined,
  })
  if (!updated)
    return {
      ok: false,
      status: 404,
      message: "This suggestion was already decided.",
    }

  return { ok: true, data: updated }
}

/**
 * Suggested options: the public list and votes (content API), and the
 * editorial board's tally and decisions (admin).
 */
export default ({ strapi }: { strapi: any }) => ({
  // GET /api/content-moderation/option-suggestions  (content-api)
  // Open suggestions, most wanted first; `voted` when the viewer is known.
  async listOpen(ctx: any) {
    const user = await resolveUser(strapi, ctx).catch(() => null)
    const rows = await listSuggestions(strapi, {
      status: "open",
      viewer: user?.id,
    })
    // Contributors see names and counts; which libraries asked (and the
    // board's follow-ups) stay here.
    ctx.body = {
      data: rows.map(
        ({
          libraries,
          unlinkedLibraries: _unlinked,
          decidedBy,
          decisionNote,
          ...r
        }) => ({
          ...r,
          libraryCount: libraries.length,
          libraries: libraries.slice(0, 3).map((l) => l.name),
        })
      ),
    }
  },

  // POST /api/content-moderation/option-suggestions/:id/vote  (content-api)
  async vote(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("Sign in to vote.")
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const result = await toggleVote(strapi, id, user.id)
    if (!result) return ctx.notFound("This suggestion isn’t open for votes.")
    ctx.body = { data: result }
  },

  // GET /content-moderation/option-suggestions  (admin)
  async adminList(ctx: any) {
    ctx.body = { data: await listSuggestions(strapi) }
  },

  // PUT /content-moderation/option-suggestions/:id  (admin)
  async decide(ctx: any) {
    const admin = ctx.state?.user
    const decidedBy =
      [admin?.firstname, admin?.lastname].filter(Boolean).join(" ") ||
      admin?.email ||
      "Editorial board"
    const result = await decideFromRequest(
      strapi,
      ctx.params?.id,
      ctx.request.body,
      decidedBy
    )
    if (!result.ok)
      return result.status === 404
        ? ctx.notFound(result.message)
        : ctx.badRequest(result.message)
    ctx.body = { data: result.data }
  },
})
