import { resolveUser } from "./submission"
import {
  decideSuggestion,
  listSuggestions,
  toggleVote,
} from "../utils/option-suggestions"
import { isDocumentId } from "../utils/params"

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
    const { id } = ctx.params
    const { decision, name, note } = (ctx.request.body ?? {}) as {
      decision?: unknown
      name?: unknown
      note?: unknown
    }
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    if (decision !== "accept" && decision !== "decline")
      return ctx.badRequest("decision must be accept or decline")
    const admin = ctx.state?.user
    const decidedBy =
      [admin?.firstname, admin?.lastname].filter(Boolean).join(" ") ||
      admin?.email ||
      "Editorial board"
    const updated = await decideSuggestion(strapi, {
      documentId: id,
      decision,
      decidedBy,
      name: typeof name === "string" ? name : undefined,
      note: typeof note === "string" ? note : undefined,
    })
    if (!updated) return ctx.notFound("This suggestion was already decided.")
    ctx.body = { data: updated }
  },
})
