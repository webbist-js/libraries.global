import { resolveUser } from "./submission"
import {
  createSuggestion,
  decideSuggestion,
  isSuggestionList,
  listSuggestions,
  NON_REMOVED_STATUSES,
  NOTE_VISIBLE_STATUSES,
  setSuggestionStatus,
  type SuggestionView,
  toggleVote,
} from "../utils/option-suggestions"
import { isDocumentId } from "../utils/params"

const DECISIONS = new Set(["accept", "decline", "review", "plan", "remove"])

/**
 * Validates a decision body and applies it: shared by the admin route and
 * the editorial board's content-api route, which differ only in who
 * `decidedBy` names. `accept`/`decline` are a decision (via decideSuggestion);
 * `review`/`plan`/`remove` just move the suggestion (via setSuggestionStatus).
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
  if (typeof decision !== "string" || !DECISIONS.has(decision))
    return {
      ok: false,
      status: 400,
      message: "decision must be accept, decline, review, plan or remove",
    }

  if (decision === "accept" || decision === "decline")
    return decideSuggestion(strapi, {
      documentId: id,
      decision,
      decidedBy,
      name: typeof name === "string" ? name : undefined,
      note: typeof note === "string" ? note : undefined,
    })

  const status =
    decision === "review"
      ? "reviewing"
      : decision === "plan"
        ? "planned"
        : "removed"
  const updated = await setSuggestionStatus(strapi, {
    documentId: id,
    status,
    decidedBy,
    note: typeof note === "string" ? note : undefined,
  })
  if (!updated)
    return {
      ok: false,
      status: 404,
      message: "This suggestion can’t move to that status.",
    }

  return { ok: true, data: updated }
}

/**
 * The public shape of a suggestion: no library names, no raw suggester id,
 * and the board's note hidden outside `NOTE_VISIBLE_STATUSES` (the board
 * and admin lists see every status's note; this mapping is what hides it
 * from everyone else).
 */
export function toPublicSuggestion(s: SuggestionView) {
  return {
    documentId: s.documentId,
    name: s.name,
    optionKey: s.optionKey,
    status: s.status,
    votes: s.votes,
    ...(s.voted !== undefined ? { voted: s.voted } : {}),
    description: s.description,
    suggestedByName: s.suggestedByName,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt ?? null,
    decisionNote: NOTE_VISIBLE_STATUSES.has(s.status)
      ? (s.decisionNote ?? null)
      : null,
    libraryCount: s.libraries.length,
  }
}

function sendError(
  ctx: any,
  status: number,
  message: string,
  details?: Record<string, unknown>
): void {
  ctx.status = status
  ctx.body = { error: details ? { message, details } : { message } }
}

/**
 * Suggested options: the public list, posting and votes (content API), and
 * the editorial board's tally and decisions (admin).
 */
export default ({ strapi }: { strapi: any }) => ({
  // GET /api/content-moderation/option-suggestions  (content-api)
  // Every non-removed suggestion, most wanted first; `voted` when the
  // viewer is known.
  async listPublic(ctx: any) {
    const user = await resolveUser(strapi, ctx).catch(() => null)
    const rows = await listSuggestions(strapi, {
      statuses: NON_REMOVED_STATUSES,
      viewer: user?.id,
    })
    ctx.body = { data: rows.map((r) => toPublicSuggestion(r)) }
  },

  // POST /api/content-moderation/option-suggestions  (content-api)
  async create(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("Sign in to suggest an option.")
    const { optionKey, name, description } = (ctx.request.body ?? {}) as {
      optionKey?: unknown
      name?: unknown
      description?: unknown
    }
    if (!isSuggestionList(optionKey))
      return sendError(
        ctx,
        400,
        "Choose a list: accessibility, amenities, services or library types."
      )
    if (typeof name !== "string" || !name.trim())
      return sendError(ctx, 400, "Give the option a name.")
    const result = await createSuggestion(strapi, {
      optionKey,
      name,
      description: typeof description === "string" ? description : null,
      baUserId: user.id,
    })
    if (!result.ok)
      return sendError(
        ctx,
        result.status,
        result.message,
        result.existingDocumentId
          ? { existingDocumentId: result.existingDocumentId }
          : undefined
      )
    ctx.status = 201
    ctx.body = { data: toPublicSuggestion(result.suggestion) }
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
    ctx.body = {
      data: await listSuggestions(strapi, { statuses: NON_REMOVED_STATUSES }),
    }
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
