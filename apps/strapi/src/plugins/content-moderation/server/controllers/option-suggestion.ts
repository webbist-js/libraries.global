import { resolveUser } from "./submission"
import {
  createSuggestion,
  decideSuggestion,
  publishSuggestion,
  isSuggestionList,
  listSuggestions,
  NON_REMOVED_STATUSES,
  NOTE_VISIBLE_STATUSES,
  setSuggestionStatus,
  type SuggestionView,
  toggleVote,
} from "../utils/option-suggestions"
import { isDocumentId } from "../utils/params"
import {
  publicComparisons,
  suggestionCatalogue,
} from "../utils/suggestion-catalogue"
import { suggestionConversationSummaries } from "../utils/suggestion-discussions"
import { updateReviewRound, reviewRoundView } from "../utils/suggestion-rounds"

const DECISIONS = new Set([
  "accept",
  "decline",
  "review",
  "plan",
  "remove",
  "publish",
  "update",
  "merge",
  "reject",
])

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
  const { decision, name, note, version, feature, existingOptionDocumentId } =
    (body ?? {}) as {
      decision?: unknown
      name?: unknown
      note?: unknown
      version?: number
      feature?: {
        summary?: string
        description?: string
        category?: string
        icon?: string
      }
      existingOptionDocumentId?: string
    }
  if (!isDocumentId(id))
    return { ok: false, status: 400, message: "Invalid id" }
  if (typeof decision !== "string" || !DECISIONS.has(decision))
    return {
      ok: false,
      status: 400,
      message:
        "Choose publish, reject, accept, update, merge, decline, review, plan or remove.",
    }

  if (
    feature !== undefined &&
    (!feature ||
      typeof feature !== "object" ||
      Array.isArray(feature) ||
      Object.values(feature).some((value) => typeof value !== "string"))
  )
    return {
      ok: false,
      status: 400,
      message: "Feature details must be text fields.",
    }
  if (decision === "accept" && !feature?.summary?.trim())
    return {
      ok: false,
      status: 400,
      message: "Give the new feature a summary so contributors understand it.",
    }
  if (!Number.isInteger(version) || (version ?? -1) < 0)
    return { ok: false, status: 400, message: "Invalid suggestion version." }
  if (decision === "reject") {
    if (typeof note !== "string" || !note.trim())
      return {
        ok: false,
        status: 400,
        message: "Explain why this cannot be published.",
      }

    return publishSuggestion(strapi, id, version ?? -1, note, decidedBy)
  }
  if (decision === "publish")
    return publishSuggestion(strapi, id, version ?? -1, undefined, decidedBy)
  if (
    ["accept", "decline", "update", "merge", "plan"].includes(decision) &&
    (typeof note !== "string" || !note.trim())
  )
    return {
      ok: false,
      status: 400,
      message: "Explain the decision; this note is public.",
    }
  if (
    decision === "accept" ||
    decision === "decline" ||
    decision === "update" ||
    decision === "merge"
  )
    return decideSuggestion(strapi, {
      documentId: id,
      decision: decision === "decline" ? "decline" : "accept",
      decisionKind:
        decision === "update" || decision === "merge" ? decision : "add",
      version,
      feature,
      existingOptionDocumentId,
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
    version,
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
    votesThisMonth: s.votesThisMonth ?? 0,
    ...(s.voted !== undefined ? { voted: s.voted } : {}),
    description: s.description,
    publicationStatus: s.publicationStatus ?? "published",
    comparison: s.comparison ?? null,
    acceptedOptionDocumentId: s.acceptedOptionDocumentId ?? null,
    decisionKind: s.decisionKind ?? null,
    ...(s.suggestedByProfile
      ? { suggestedByProfile: s.suggestedByProfile }
      : {}),
    suggestedByName: s.suggestedByName,
    ...(s.suggestedByBadges?.length
      ? { suggestedByBadges: s.suggestedByBadges }
      : {}),
    createdAt: s.createdAt,
    decidedAt: s.decidedAt ?? null,
    decisionNote:
      s.publicDecisionNote ??
      (NOTE_VISIBLE_STATUSES.has(s.status) ? (s.decisionNote ?? null) : null),
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
  async catalogue(ctx: any) {
    ctx.body = await suggestionCatalogue(strapi, ctx.query?.locale)
  },
  async round(ctx: any) {
    ctx.body = { data: await reviewRoundView(strapi, false) }
  },
  async manageRound(ctx: any) {
    const result = await updateReviewRound(strapi, ctx.request.body ?? {})
    if (!result.ok) {
      ctx.status = result.status
      ctx.body = { error: { message: result.message } }

      return
    }
    ctx.body = { data: await reviewRoundView(strapi, false) }
  },
  // GET /api/content-moderation/option-suggestions  (content-api)
  // Every non-removed suggestion, most wanted first; `voted` when the
  // viewer is known.
  async listPublic(ctx: any) {
    const user = await resolveUser(strapi, ctx).catch(() => null)
    const rows = await listSuggestions(strapi, {
      statuses: NON_REMOVED_STATUSES,
      viewer: user?.id,
      publicOnly: true,
      includeOwnPending: true,
    })
    const round = await reviewRoundView(strapi)
    const conversations = await suggestionConversationSummaries(
      strapi,
      rows
        .filter((r) => r.publicationStatus === "published")
        .map((r) => r.documentId)
    )
    ctx.set?.("Cache-Control", "no-store")
    ctx.body = {
      data: (await publicComparisons(strapi, rows)).map((r) => ({
        ...toPublicSuggestion(r),
        commentCount: conversations.get(r.documentId)?.count ?? 0,
        conversation: conversations.get(r.documentId) ?? null,
      })),
      round,
    }
  },

  async findPublic(ctx: any) {
    if (!isDocumentId(ctx.params.id)) return ctx.notFound()
    const rows = await listSuggestions(strapi, {
      statuses: NON_REMOVED_STATUSES,
      publicOnly: true,
    })
    const item = rows.find((r) => r.documentId === ctx.params.id)
    if (!item || item.publicationStatus !== "published") return ctx.notFound()
    const [safe] = await publicComparisons(strapi, [item])
    const conversations = await suggestionConversationSummaries(strapi, [
      item.documentId,
    ])
    ctx.body = {
      data: {
        ...toPublicSuggestion(safe!),
        commentCount: conversations.get(item.documentId)?.count ?? 0,
        conversation: conversations.get(item.documentId) ?? null,
      },
    }
  },

  // POST /api/content-moderation/option-suggestions  (content-api)
  async create(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("Sign in to suggest an option.")
    const { optionKey, name, description, comparison } = (ctx.request.body ??
      {}) as {
      optionKey?: unknown
      name?: unknown
      description?: unknown
      comparison?: { documentId?: unknown; explanation?: unknown }
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
      comparison,
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
