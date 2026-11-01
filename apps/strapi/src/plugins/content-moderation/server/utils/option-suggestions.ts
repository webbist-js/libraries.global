import { compareSuggestionRank, findUnsafeContent } from "@repo/shared-data"
import type { PublicAuthorBadge } from "strapi-plugin-discussions/types"

import { allDocuments } from "./documents-all"
import { isDocumentId } from "./params"
import { ApplyRefusedError, applyToPublished } from "./publish-guard"
import { syncReviewRound, withBoardLock, ROUND } from "./suggestion-rounds"
import { isActivityPublic } from "../../../../utils/activity-visibility"
import { LIBRARY_TYPE } from "../../../../utils/library-type-catalogue"
import { publicAuthorRoleBadges } from "../../../../utils/public-author-badges"

/**
 * New accessibility features, services, amenities and library types that
 * contributors asked for: posted directly from `/community/suggestions`, or
 * named in a correction (where a suggestion is recorded once a moderator
 * approves it, so only vetted names reach the list). Signed-in contributors
 * vote on undecided suggestions; the editorial board reviews them monthly
 * in the moderation plugin, moving them through New → Under review →
 * Planned → Added or Not adding (or Removed, hidden from everyone,
 * including the board). Accepting a services/amenities/accessibility suggestion adds the
 * option to its list and links it to every library that asked for it;
 * accepting a library type only renames it to the schema's spelling, since
 * the enum itself is changed by hand.
 */

export const SUGGESTION = "plugin::content-moderation.option-suggestion"
export const VOTE = "plugin::content-moderation.option-vote"
const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"

export const OPTION_UIDS = {
  accessibility: "api::accessibility.accessibility",
  amenities: "api::amenity.amenity",
  services: "api::service.service",
} as const

export type OptionKey = keyof typeof OPTION_UIDS

export const isOptionKey = (v: unknown): v is OptionKey =>
  typeof v === "string" && v in OPTION_UIDS

/** The four lists a contributor can suggest an addition to. */
export const SUGGESTION_LISTS = [
  "accessibility",
  "amenities",
  "services",
  "library_types",
] as const

export type SuggestionList = (typeof SUGGESTION_LISTS)[number]

export const isSuggestionList = (v: unknown): v is SuggestionList =>
  typeof v === "string" && (SUGGESTION_LISTS as readonly string[]).includes(v)

/** A suggestion contributors can still vote on. */
export const VOTABLE_STATUSES = new Set(["open", "reviewing", "planned"])

/** A suggestion the board hasn't decided yet: it can still move or be decided. */
const UNDECIDED_STATUSES = new Set(["open", "reviewing", "planned"])

/**
 * Every status except `removed`, for callers that list suggestions:
 * `removed` is hidden from everyone, including the board, so it's excluded
 * in the query rather than filtered out of the result afterwards.
 */
export const NON_REMOVED_STATUSES = [
  "open",
  "reviewing",
  "planned",
  "accepted",
  "declined",
] as const

/**
 * `decisionNote` is shown publicly only for these statuses (declined names
 * stay declined, so contributors should know why; a planned one tells them
 * when). The board and admin lists see every status's note (applied only
 * in the content-api controller's public mapping, not here).
 */
export const NOTE_VISIBLE_STATUSES = new Set(["declined", "planned"])

export const DAILY_SUGGESTION_LIMIT = 5

export const nameKeyOf = (name: string) =>
  name.trim().replaceAll(/\s+/g, " ").toLowerCase()

type LibraryRef = { documentId: string; name: string }

/**
 * A library an accepted suggestion could not be linked to: it has no
 * published version (`not_published`, the publish guard refused) or it no
 * longer exists (`not_found`). Kept on the suggestion so the board can
 * follow up by hand; the option itself is created either way.
 */
export type UnlinkedLibrary = LibraryRef & {
  reason: "not_published" | "not_found"
}

type SuggestionStatus =
  | "open"
  | "reviewing"
  | "planned"
  | "accepted"
  | "declined"
  | "removed"

type SuggestionRow = {
  documentId: string
  name: string
  nameKey: string
  optionKey: SuggestionList
  status: SuggestionStatus
  publicationStatus?: "pending" | "published" | "rejected"
  publicationAt?: string | null
  comparison?: { documentId: string; name: string; explanation: string } | null
  decisionKind?: "add" | "update" | "merge" | "decline" | null
  version?: number
  requests?: number | null
  libraries?: LibraryRef[] | null
  submissionIds?: string[] | null
  acceptedOptionDocumentId?: string | null
  unlinkedLibraries?: UnlinkedLibrary[] | null
  description?: string | null
  suggestedBy?: string | null
  decidedAt?: string | null
  decidedBy?: string | null
  decisionNote?: string | null
  publicDecisionNote?: string | null
  createdAt?: string
}

/**
 * Adds one request for this name: a new open suggestion, or one more
 * request (and library) on the existing one. A declined or removed name is
 * left as is; an accepted one never gets here (it's in the list by then).
 */
async function recordSuggestionUnlocked(
  strapi: any,
  input: {
    optionKey: OptionKey
    name: string
    library: LibraryRef
    submissionId: string
    submittedBy?: string
  }
): Promise<"created" | "counted" | "declined"> {
  const nameKey = nameKeyOf(input.name)
  const [existing] = (await strapi.documents(SUGGESTION).findMany({
    filters: { optionKey: { $eq: input.optionKey }, nameKey: { $eq: nameKey } },
    limit: 1,
  })) as SuggestionRow[]

  if (!existing) {
    await strapi.documents(SUGGESTION).create({
      data: {
        name: input.name.trim().replaceAll(/\s+/g, " ").slice(0, 80),
        nameKey,
        optionKey: input.optionKey,
        status: "open",
        requests: 1,
        libraries: [input.library],
        submissionIds: [input.submissionId],
        suggestedBy: input.submittedBy ?? null,
      },
    })

    return "created"
  }
  if (existing.status === "declined" || existing.status === "removed")
    return "declined"

  const submissionIds = existing.submissionIds ?? []
  if (submissionIds.includes(input.submissionId)) return "counted"
  const libraries = existing.libraries ?? []
  await strapi.documents(SUGGESTION).update({
    documentId: existing.documentId,
    data: {
      requests: (existing.requests ?? 0) + 1,
      submissionIds: [...submissionIds, input.submissionId],
      libraries: libraries.some(
        (l) => l.documentId === input.library.documentId
      )
        ? libraries
        : [...libraries, input.library],
    },
  })

  return "counted"
}

export type SuggestionView = {
  documentId: string
  name: string
  optionKey: SuggestionList
  status: SuggestionRow["status"]
  requests: number
  votes: number
  votesThisMonth?: number
  /** Whether the viewer voted (list for a signed-in viewer only). */
  voted?: boolean
  libraries: LibraryRef[]
  /** Accepted suggestions only: the libraries still to link by hand. */
  unlinkedLibraries: UnlinkedLibrary[]
  publicationStatus?: "pending" | "published" | "rejected"
  publicationAt?: string | null
  comparison?: { documentId: string; name: string; explanation: string } | null
  decisionKind?: string | null
  acceptedOptionDocumentId?: string | null
  version?: number
  suggestedByProfile?: string | null
  suggestedByBadges?: PublicAuthorBadge[]
  description: string | null
  suggestedBy: string | null
  /** "Firstname L.", only when the suggester's profile activity is public. */
  suggestedByName: string | null
  createdAt?: string
  decidedAt?: string | null
  decidedBy?: string | null
  /**
   * The board's note, whatever the status. Only the content-api
   * controller's public mapping hides it outside `NOTE_VISIBLE_STATUSES`.
   */
  decisionNote?: string | null
  publicDecisionNote?: string | null
}

const snakeCase = (s: string) =>
  s.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()

/** The vote table and column, from the model's metadata (never hard-coded). */
function voteColumns(strapi: any): {
  table: string
  suggestion: string
  created: string
} {
  const meta = strapi.db?.metadata?.get?.(VOTE)
  const schema = strapi.contentType?.(VOTE)
  const table: string =
    meta?.tableName ?? schema?.collectionName ?? "cm_option_votes"
  const suggestion: string =
    meta?.attributes?.suggestionDocumentId?.columnName ??
    snakeCase("suggestionDocumentId")

  return {
    table,
    suggestion,
    created: meta?.attributes?.createdAt?.columnName ?? "created_at",
  }
}

/** Vote counts per suggestion, aggregated in the database. */
async function countVotes(
  strapi: any,
  suggestionIds: readonly string[],
  since?: Date
): Promise<Map<string, number>> {
  const count = new Map<string, number>()
  if (suggestionIds.length === 0) return count
  const { table, suggestion, created } = voteColumns(strapi)
  const query = strapi.db
    .connection(table)
    .select(suggestion)
    .count("* as votes")
    .whereIn(suggestion, [...suggestionIds])
    .groupBy(suggestion)
  if (since) query.where(created, ">=", since.toISOString())
  const rows = (await query) as Record<string, unknown>[]
  for (const r of rows) {
    const id = r[suggestion]
    if (typeof id === "string") count.set(id, Number(r.votes ?? 0))
  }

  return count
}

/** Postgres `23505`, or sqlite's constraint error: the row already exists. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown; message?: unknown }

  return (
    e?.code === "23505" ||
    e?.code === "SQLITE_CONSTRAINT" ||
    e?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    /unique constraint/i.test(String(e?.message ?? ""))
  )
}

/** "Alex B.", or the username, or null when neither is set. */
function displayName(p: {
  firstName?: string | null
  lastName?: string | null
  username?: string | null
}): string | null {
  const first = p.firstName?.trim()
  const lastInitial = p.lastName?.trim()?.[0]
  if (first) return lastInitial ? `${first} ${lastInitial}.` : first

  return p.username?.trim() || null
}

/** Suggestions with their vote counts, most wanted first. */
export async function listSuggestions(
  strapi: any,
  opts: {
    status?: SuggestionRow["status"]
    statuses?: readonly SuggestionRow["status"][]
    viewer?: string
    publicOnly?: boolean
    includeOwnPending?: boolean
  } = {}
): Promise<SuggestionView[]> {
  const filters = opts.status
    ? { status: { $eq: opts.status } }
    : opts.statuses
      ? { status: { $in: opts.statuses } }
      : undefined
  const publication = opts.publicOnly
    ? {
        $or: [
          { publicationStatus: { $eq: "published" } },
          ...(opts.includeOwnPending && opts.viewer
            ? [
                {
                  publicationStatus: { $in: ["pending", "rejected"] },
                  suggestedBy: { $eq: opts.viewer },
                },
              ]
            : []),
        ],
      }
    : {}
  const rows = (await allDocuments(strapi, SUGGESTION, {
    filters: { ...filters, ...publication },
    sort: ["createdAt:asc", "documentId:asc"],
  })) as SuggestionRow[]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.documentId)
  const count = await countVotes(strapi, ids)
  const now = new Date()
  const monthly = await countVotes(
    strapi,
    ids,
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  )
  const mine = new Set<string>()
  if (opts.viewer) {
    const own = await allDocuments(strapi, VOTE, {
      filters: {
        baUserId: { $eq: opts.viewer },
        suggestionDocumentId: { $in: ids },
      },
      fields: ["suggestionDocumentId"],
    })
    for (const vote of own) mine.add(vote.suggestionDocumentId)
  }

  // One batch read for every suggester's profile, not one per row.
  const suggesterIds = [
    ...new Set(
      rows
        .map((r) => r.suggestedBy)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ]
  const names = new Map<string, string | null>()
  const profilesById = new Map<string, string>()
  const badgesById = new Map<string, PublicAuthorBadge[]>()
  if (suggesterIds.length > 0) {
    const profiles = (await allDocuments(strapi, PROFILE, {
      filters: { baUserId: { $in: suggesterIds } },
      fields: [
        "baUserId",
        "firstName",
        "lastName",
        "username",
        "profileVisibility",
        "publicPrefs",
      ],
    })) as {
      baUserId: string
      firstName?: string | null
      lastName?: string | null
      username?: string | null
      profileVisibility?: string
      publicPrefs?: { showActivity?: boolean } | null
    }[]
    for (const p of profiles) {
      names.set(p.baUserId, isActivityPublic(p) ? displayName(p) : null)
      if (isActivityPublic(p) && p.username)
        profilesById.set(p.baUserId, p.username)
    }
    await Promise.all(
      profiles
        .filter(
          (p) =>
            p.profileVisibility === "public" &&
            isActivityPublic(p) &&
            displayName(p)
        )
        .map(async (p) => {
          badgesById.set(
            p.baUserId,
            await publicAuthorRoleBadges(strapi, p.baUserId)
          )
        })
    )
  }

  return rows
    .map((r) => ({
      documentId: r.documentId,
      name: r.name,
      optionKey: r.optionKey,
      status: r.status,
      requests: r.requests ?? 0,
      votes: count.get(r.documentId) ?? 0,
      votesThisMonth: monthly.get(r.documentId) ?? 0,
      ...(opts.viewer ? { voted: mine.has(r.documentId) } : {}),
      libraries: r.libraries ?? [],
      unlinkedLibraries: r.unlinkedLibraries ?? [],
      publicationStatus: r.publicationStatus ?? "published",
      publicationAt: r.publicationAt ?? r.createdAt ?? null,
      comparison: r.comparison ?? null,
      decisionKind: r.decisionKind ?? null,
      acceptedOptionDocumentId: r.acceptedOptionDocumentId ?? null,
      version: r.version ?? 0,
      suggestedByProfile: r.suggestedBy
        ? (profilesById.get(r.suggestedBy) ?? null)
        : null,
      suggestedByBadges: r.suggestedBy
        ? (badgesById.get(r.suggestedBy) ?? [])
        : [],
      description: r.description ?? null,
      suggestedBy: r.suggestedBy ?? null,
      suggestedByName: r.suggestedBy
        ? (names.get(r.suggestedBy) ?? null)
        : null,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt ?? null,
      decidedBy: r.decidedBy ?? null,
      // Every caller sees the real note here; the content-api controller's
      // public mapping is the one that hides it outside NOTE_VISIBLE_STATUSES.
      decisionNote: r.decisionNote ?? null,
      publicDecisionNote: r.publicDecisionNote ?? null,
    }))
    .sort(compareSuggestionRank)
}

/** Adds or removes the viewer's vote on a still-undecided suggestion. */
async function toggleVoteUnlocked(
  strapi: any,
  suggestionDocumentId: string,
  baUserId: string,
  creator = false
): Promise<{ voted: boolean; votes: number } | null> {
  if (!isDocumentId(suggestionDocumentId)) return null
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: suggestionDocumentId })) as SuggestionRow | null
  if (
    !suggestion ||
    !VOTABLE_STATUSES.has(suggestion.status) ||
    (!creator &&
      suggestion.publicationStatus !== undefined &&
      suggestion.publicationStatus !== "published")
  )
    return null
  if (!creator && strapi.contentType?.(ROUND)?.attributes?.cutoffAt) {
    const round = await syncReviewRound(strapi)
    if (
      round.state === "review" &&
      round.shortlist?.some(
        (item: any) => item.documentId === suggestionDocumentId
      )
    )
      return null
  }

  const mine = (await strapi.documents(VOTE).findMany({
    filters: {
      suggestionDocumentId: { $eq: suggestionDocumentId },
      baUserId: { $eq: baUserId },
    },
    fields: ["documentId"],
  })) as { documentId: string }[]
  let voted: boolean
  if (mine.length > 0) {
    for (const v of mine)
      await strapi.documents(VOTE).delete({ documentId: v.documentId })
    voted = false
  } else {
    // One vote per user and suggestion is a unique index; two concurrent
    // toggles both see no vote, and the second create fails on it. That
    // means "already voted", not an error, and never a second delete.
    try {
      await strapi
        .documents(VOTE)
        .create({ data: { suggestionDocumentId, baUserId } })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
    voted = true
  }
  const votes = await strapi.documents(VOTE).count({
    filters: { suggestionDocumentId: { $eq: suggestionDocumentId } },
  })

  return { voted, votes }
}

/** Targets of a board status change that isn't an accept/decline decision. */
const MOVE_TARGETS = {
  reviewing: new Set(["open"]),
  planned: new Set(["open", "reviewing"]),
  removed: new Set(["open", "reviewing", "planned"]),
} as const

/**
 * Moves a suggestion between New, Under review, Planned and Removed,
 * without deciding it. A suggestion already in a final status (accepted,
 * declined, removed) can't move.
 */
async function setSuggestionStatusUnlocked(
  strapi: any,
  input: {
    documentId: string
    status: "reviewing" | "planned" | "removed"
    decidedBy: string
    note?: string
    version?: number
  }
): Promise<SuggestionRow | null> {
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: input.documentId })) as SuggestionRow | null
  if (
    !suggestion ||
    (input.version !== undefined &&
      input.version !== (suggestion.version ?? 0)) ||
    (suggestion.publicationStatus === "pending" &&
      input.status !== "removed") ||
    !MOVE_TARGETS[input.status].has(suggestion.status)
  )
    return null

  const data: Record<string, unknown> = {
    status: input.status,
    version: (suggestion.version ?? 0) + 1,
  }
  // "Under review" is a holding state, not a decision: no decidedAt/By.
  if (input.status !== "reviewing") {
    data.decidedAt = new Date()
    data.decidedBy = input.decidedBy
  }
  if (input.status === "planned")
    data.decisionNote = input.note?.trim().slice(0, 2000) || null

  return strapi.documents(SUGGESTION).update({
    documentId: suggestion.documentId,
    data,
  })
}

/**
 * The editorial board's decision. Accepting finds the option by name (or
 * creates it, published), links it to every library that asked for it,
 * and publishes those libraries. `name` lets the board tidy the wording.
 * A library type has no option collection: accepting only renames it to
 * the schema enum's spelling, and is refused until the enum has the value.
 */
async function decideSuggestionUnlocked(
  strapi: any,
  input: {
    documentId: string
    decision: "accept" | "decline"
    decidedBy: string
    name?: string
    note?: string
    decisionKind?: "add" | "update" | "merge"
    existingOptionDocumentId?: string
    feature?: {
      summary?: string
      description?: string
      icon?: string
      category?: string
    }
    version?: number
  }
): Promise<
  | { ok: true; data: SuggestionRow }
  | { ok: false; status: 400 | 404; message: string }
> {
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: input.documentId })) as SuggestionRow | null
  if (!suggestion || !UNDECIDED_STATUSES.has(suggestion.status))
    return {
      ok: false,
      status: 404,
      message: "This suggestion was already decided.",
    }
  if (
    input.version !== undefined &&
    input.version !== (suggestion.version ?? 0)
  )
    return {
      ok: false,
      status: 400,
      message: "This suggestion changed. Reload before deciding.",
    }
  if (suggestion.publicationStatus === "pending")
    return {
      ok: false,
      status: 400,
      message: "Review publication before deciding the idea.",
    }
  const note = input.note?.trim().slice(0, 2000) || null
  const decided = {
    decidedAt: new Date(),
    decidedBy: input.decidedBy,
    version: (suggestion.version ?? 0) + 1,
  }

  if (input.decision === "decline") {
    if (!note)
      return {
        ok: false,
        status: 400,
        message: "Add a note: it’s shown with the suggestion.",
      }

    return {
      ok: true,
      data: await strapi.documents(SUGGESTION).update({
        documentId: suggestion.documentId,
        data: {
          status: "declined",
          decisionKind: "decline",
          decisionNote: note,
          publicDecisionNote: note,
          ...decided,
        },
      }),
    }
  }

  const name = (input.name?.trim() || suggestion.name).slice(0, 80)
  const uid =
    suggestion.optionKey === "library_types"
      ? LIBRARY_TYPE
      : OPTION_UIDS[suggestion.optionKey as OptionKey]
  const [existing] = await strapi.documents(uid).findMany({
    filters: { name: { $eqi: name } },
    fields: ["documentId"],
    status: "published",
    limit: 1,
  })
  const kind = input.decisionKind ?? "add"
  let option = existing
  if (kind !== "add") {
    if (!isDocumentId(input.existingOptionDocumentId))
      return {
        ok: false,
        status: 400,
        message: "Choose an existing published option.",
      }
    option = await strapi.documents(uid).findOne({
      documentId: input.existingOptionDocumentId,
      status: "published",
    })
    if (!option)
      return {
        ok: false,
        status: 400,
        message: "The existing option is unavailable.",
      }
  }
  const feature = input.feature ?? {}
  const summary = feature.summary?.trim()
  const description = feature.description?.trim()
  const icon = feature.icon?.trim()
  const category = feature.category?.trim()
  if (
    (summary?.length ?? 0) > 400 ||
    (description?.length ?? 0) > 4000 ||
    (icon && !/^[a-z0-9-]+:[a-z0-9-]+$/i.test(icon)) ||
    (category &&
      !(strapi.contentType?.(uid)?.attributes?.category?.enum ?? []).includes(
        category
      )) ||
    findUnsafeContent({ summary, description })
  )
    return {
      ok: false,
      status: 400,
      message: "Check the feature description, icon and category.",
    }
  if (kind === "add" && option && input.decisionKind === "add")
    return {
      ok: false,
      status: 400,
      message:
        "An option with this name already exists. Choose merge or clarify instead.",
    }
  if (kind === "add" && !option && input.feature && !summary)
    return {
      ok: false,
      status: 400,
      message: "Give the new feature a summary so contributors understand it.",
    }
  if (findUnsafeContent({ name }))
    return {
      ok: false,
      status: 400,
      message: "Check the accepted feature name.",
    }
  const featureData = {
    ...(summary ? { summary } : {}),
    ...(description
      ? {
          description: [
            {
              type: "paragraph",
              children: [{ type: "text", text: description }],
            },
          ],
        }
      : {}),
    ...(icon ? { icon: { iconName: icon } } : {}),
    ...(category ? { category } : {}),
  }
  if (kind === "update") {
    if (!Object.keys(featureData).length)
      return {
        ok: false,
        status: 400,
        message: "Supply the clarification to add to the existing option.",
      }
    if (description)
      featureData.description = [
        ...(Array.isArray(option.description) ? option.description : []),
        ...featureData.description!,
      ]
    await applyToPublished(strapi, uid, option.documentId, featureData)
  } else if (!option) {
    option = await strapi
      .documents(uid)
      .create({ data: { name, ...featureData }, status: "published" })
  }

  // One library can't hold up the board's decision: a library that can't
  // take the link now is recorded on the suggestion for a follow-up by hand.
  const unlinkedLibraries: UnlinkedLibrary[] = []
  for (const lib of suggestion.libraries ?? []) {
    if (!isDocumentId(lib.documentId)) continue
    const found = await strapi
      .documents(LIBRARY)
      .findOne({ documentId: lib.documentId, fields: ["documentId", "locale"] })
    if (!found) {
      unlinkedLibraries.push({ ...lib, reason: "not_found" })
      strapi.log.warn(
        `[content-moderation] suggestion "${name}": library ${lib.documentId} not found; not linked`
      )
      continue
    }
    try {
      await applyToPublished(
        strapi,
        LIBRARY,
        found.documentId,
        {
          ...(suggestion.optionKey === "library_types"
            ? { libraryType: { set: [{ documentId: option.documentId }] } }
            : {
                [suggestion.optionKey]: {
                  connect: [{ documentId: option.documentId }],
                },
              }),
          contentUpdatedAt: new Date(),
        },
        { locale: found.locale ?? undefined }
      )
    } catch (err) {
      if (!(err instanceof ApplyRefusedError)) throw err
      unlinkedLibraries.push({ ...lib, reason: "not_published" })
      strapi.log.warn(
        `[content-moderation] suggestion "${name}": library ${found.documentId} is not published; not linked`
      )
    }
  }
  strapi.log.info(
    `[content-moderation] accepted suggestion "${name}" (${suggestion.optionKey}) for ${(suggestion.libraries ?? []).length} libraries${unlinkedLibraries.length ? ` (${unlinkedLibraries.length} not linked)` : ""}`
  )

  // The board lock owns the transaction, so a failed reward rolls back
  // the decision and published changes. Legacy anonymous ideas have no recipient.
  if (suggestion.suggestedBy) {
    await strapi.plugin("rewards").service("points").award(
      suggestion.suggestedBy,
      "option_suggestion_accepted",
      5,
      {
        suggestionId: suggestion.documentId,
        optionDocumentId: option.documentId,
      },
      `${suggestion.documentId}:option_suggestion_accepted`,
      decided.decidedAt
    )
  }

  return {
    ok: true,
    data: await strapi.documents(SUGGESTION).update({
      documentId: suggestion.documentId,
      data: {
        status: "accepted",
        name: option.name,
        acceptedOptionDocumentId: option.documentId,
        decisionKind: kind,
        unlinkedLibraries,
        decisionNote: note,
        publicDecisionNote: note,
        ...decided,
      },
    }),
  }
}

/**
 * Posts a new suggestion directly (`/community/suggestions`), with the
 * creator's own vote. Refuses an unsafe or malformed name/description, a
 * name that's already in the list (published, or already suggested), and
 * more than `DAILY_SUGGESTION_LIMIT` suggestions from the same contributor
 * in 24 hours.
 */
async function createSuggestionUnlocked(
  strapi: any,
  input: {
    optionKey: SuggestionList
    name: string
    description?: string | null
    baUserId: string
    comparison?: { documentId?: unknown; explanation?: unknown } | null
  }
): Promise<
  | { ok: true; suggestion: SuggestionView }
  | {
      ok: false
      status: 400 | 409 | 429
      message: string
      existingDocumentId?: string
    }
> {
  const name = input.name.trim().replaceAll(/\s+/g, " ")
  if (name.length < 2)
    return {
      ok: false,
      status: 400,
      message: "Name must be at least 2 characters.",
    }
  if (name.length > 80)
    return {
      ok: false,
      status: 400,
      message: "Name must be 80 characters or fewer.",
    }
  const description = input.description?.trim() || null
  if (description && description.length > 400)
    return {
      ok: false,
      status: 400,
      message: "Description must be 400 characters or fewer.",
    }
  const issue = findUnsafeContent({ name, description })
  if (issue) return { ok: false, status: 400, message: issue.message }

  const nameKey = nameKeyOf(name)

  const uid =
    input.optionKey === "library_types"
      ? LIBRARY_TYPE
      : OPTION_UIDS[input.optionKey]
  const [existingOption] = await strapi.documents(uid).findMany({
    filters: { name: { $eqi: name } },
    fields: ["documentId"],
    status: "published",
    limit: 1,
  })
  if (existingOption)
    return {
      ok: false,
      status: 409,
      message: "That option is already in the lists.",
    }

  const [existingSuggestion] = (await strapi.documents(SUGGESTION).findMany({
    filters: { optionKey: { $eq: input.optionKey }, nameKey: { $eq: nameKey } },
    limit: 1,
  })) as SuggestionRow[]
  if (
    existingSuggestion &&
    !(
      existingSuggestion.publicationStatus === "rejected" &&
      existingSuggestion.suggestedBy === input.baUserId
    )
  ) {
    if (
      existingSuggestion.publicationStatus &&
      existingSuggestion.publicationStatus !== "published"
    )
      return {
        ok: false,
        status: 409,
        message: "This name is unavailable. Choose another name.",
      }
    if (
      existingSuggestion.status === "open" ||
      existingSuggestion.status === "reviewing" ||
      existingSuggestion.status === "planned" ||
      existingSuggestion.status === "accepted"
    )
      return {
        ok: false,
        status: 409,
        message: "Someone has already suggested this. Vote for it instead.",
        existingDocumentId: existingSuggestion.documentId,
      }

    return {
      ok: false,
      status: 409,
      message: "The editorial board decided not to add this one.",
    }
  }

  let comparison: {
    documentId: string
    name: string
    explanation: string
  } | null = null
  if (input.comparison) {
    const { documentId, explanation } = input.comparison
    if (
      !isDocumentId(documentId) ||
      typeof explanation !== "string" ||
      !explanation.trim() ||
      explanation.length > 400 ||
      findUnsafeContent(explanation)
    )
      return {
        ok: false,
        status: 400,
        message:
          "Choose a published feature and explain how this differs (up to 400 characters).",
      }
    const reference = await strapi
      .documents(
        input.optionKey === "library_types"
          ? LIBRARY_TYPE
          : OPTION_UIDS[input.optionKey]
      )
      .findOne({ documentId, status: "published", fields: ["name"] })
    if (!reference)
      return {
        ok: false,
        status: 400,
        message: "That comparison feature is unavailable.",
      }
    comparison = {
      documentId,
      name: reference.name,
      explanation: explanation.trim(),
    }
  }

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const recentCount = await strapi.documents(SUGGESTION).count({
    filters: {
      suggestedBy: { $eq: input.baUserId },
      createdAt: { $gte: dayAgo },
    },
  })
  if (recentCount >= DAILY_SUGGESTION_LIMIT)
    return {
      ok: false,
      status: 429,
      message: "You can suggest up to 5 options a day.",
    }

  // requests counts correction requests for the same name; a direct post
  // isn't one (the creator's vote, added below, already counts them).
  const data = {
    name,
    nameKey,
    optionKey: input.optionKey,
    status: "open",
    publicationStatus: "pending",
    comparison,
    description,
    suggestedBy: input.baUserId,
  }
  const created =
    existingSuggestion?.publicationStatus === "rejected"
      ? await strapi.documents(SUGGESTION).update({
          documentId: existingSuggestion.documentId,
          data: {
            ...data,
            decidedAt: null,
            decidedBy: null,
            decisionNote: null,
            publicDecisionNote: null,
            version: (existingSuggestion.version ?? 0) + 1,
          },
        })
      : await strapi.documents(SUGGESTION).create({
          data: { ...data, requests: 0, libraries: [], submissionIds: [] },
        })
  const [ownVote] = await strapi.documents(VOTE).findMany({
    filters: {
      suggestionDocumentId: { $eq: created.documentId },
      baUserId: { $eq: input.baUserId },
    },
    limit: 1,
  })
  const vote = ownVote
    ? {
        voted: true,
        votes: await strapi.documents(VOTE).count({
          filters: { suggestionDocumentId: { $eq: created.documentId } },
        }),
      }
    : await toggleVoteUnlocked(strapi, created.documentId, input.baUserId, true)

  const [profile] = (await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $eq: input.baUserId } },
    fields: [
      "baUserId",
      "firstName",
      "lastName",
      "username",
      "profileVisibility",
      "publicPrefs",
    ],
    limit: 1,
  })) as {
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    profileVisibility?: string
    publicPrefs?: { showActivity?: boolean } | null
  }[]
  const suggestedByName =
    profile && isActivityPublic(profile) ? displayName(profile) : null

  return {
    ok: true,
    suggestion: {
      documentId: created.documentId,
      name: created.name,
      optionKey: created.optionKey,
      status: created.status,
      publicationStatus: "pending",
      comparison,
      version: created.version ?? 0,
      requests: created.requests ?? 0,
      votes: vote?.votes ?? 1,
      voted: vote?.voted ?? true,
      libraries: created.libraries ?? [],
      unlinkedLibraries: created.unlinkedLibraries ?? [],
      description: created.description ?? null,
      suggestedBy: created.suggestedBy ?? null,
      suggestedByName,
      createdAt: created.createdAt,
      decidedAt: null,
      decidedBy: null,
      decisionNote: null,
    },
  }
}

export async function toggleVote(
  ...args: Parameters<typeof toggleVoteUnlocked>
) {
  return withBoardLock(args[0], async () => {
    if (args[0].contentType?.(ROUND)?.attributes?.cutoffAt)
      await syncReviewRound(args[0])

    return toggleVoteUnlocked(...args)
  })
}

export async function createSuggestion(
  ...args: Parameters<typeof createSuggestionUnlocked>
) {
  return withBoardLock(args[0], async () => {
    if (args[0].contentType?.(ROUND)?.attributes?.cutoffAt)
      await syncReviewRound(args[0])

    return createSuggestionUnlocked(...args)
  })
}

export async function decideSuggestion(
  ...args: Parameters<typeof decideSuggestionUnlocked>
) {
  return withBoardLock(args[0], async () => {
    if (args[0].contentType?.(ROUND)?.attributes?.cutoffAt)
      await syncReviewRound(args[0])

    return decideSuggestionUnlocked(...args)
  })
}

export async function publishSuggestion(
  strapi: any,
  documentId: string,
  version: number,
  rejectionNote?: string,
  reviewer = "Editorial board"
) {
  return withBoardLock(strapi, async () => {
    await syncReviewRound(strapi)
    const item = await strapi.documents(SUGGESTION).findOne({ documentId })
    if (
      !item ||
      item.status === "removed" ||
      item.publicationStatus !== "pending" ||
      version !== (item.version ?? 0)
    )
      return {
        ok: false,
        status: 400,
        message: "This publication review changed. Reload the list.",
      }
    const audit = {
      publicationReviewedAt: new Date().toISOString(),
      publicationReviewedBy: reviewer,
      publicationHistory: [
        ...(Array.isArray(item.publicationHistory)
          ? item.publicationHistory
          : []),
        {
          at: new Date().toISOString(),
          by: reviewer,
          outcome: rejectionNote?.trim() ? "rejected" : "approved",
          version: item.version ?? 0,
          note: rejectionNote?.trim().slice(0, 2000) ?? null,
        },
      ],
    }
    if (rejectionNote?.trim()) {
      const data = await strapi.documents(SUGGESTION).update({
        documentId,
        data: {
          publicationStatus: "rejected",
          status: "declined",
          ...audit,
          decidedBy: reviewer,
          decisionNote: rejectionNote.trim().slice(0, 2000),
          decidedAt: new Date().toISOString(),
          version: (item.version ?? 0) + 1,
        },
      })

      return { ok: true, data }
    }
    if (item.comparison) {
      const target = await strapi
        .documents(
          item.optionKey === "library_types"
            ? LIBRARY_TYPE
            : OPTION_UIDS[item.optionKey as OptionKey]
        )
        .findOne({
          documentId: item.comparison.documentId,
          status: "published",
          fields: ["name"],
        })
      if (!target)
        return {
          ok: false,
          status: 400,
          message:
            "The comparison is no longer published. Reject with feedback so the contributor can revise it.",
        }
    }
    {
      const [duplicate] = await strapi
        .documents(
          item.optionKey === "library_types"
            ? LIBRARY_TYPE
            : OPTION_UIDS[item.optionKey as OptionKey]
        )
        .findMany({
          status: "published",
          filters: { name: { $eqi: item.name } },
          limit: 1,
        })
      if (duplicate)
        return {
          ok: false,
          status: 400,
          message:
            "This feature now exists. Remove the duplicate suggestion instead.",
        }
    }
    const data = await strapi.documents(SUGGESTION).update({
      documentId,
      data: {
        publicationStatus: "published",
        publicationAt: new Date().toISOString(),
        ...audit,
        version: (item.version ?? 0) + 1,
      },
    })

    return { ok: true, data }
  })
}

export async function recordSuggestion(
  ...args: Parameters<typeof recordSuggestionUnlocked>
) {
  return withBoardLock(args[0], async () => {
    if (args[0].contentType?.(ROUND)?.attributes?.cutoffAt)
      await syncReviewRound(args[0])

    return recordSuggestionUnlocked(...args)
  })
}
export async function setSuggestionStatus(
  ...args: Parameters<typeof setSuggestionStatusUnlocked>
) {
  return withBoardLock(args[0], async () => {
    if (args[0].contentType?.(ROUND)?.attributes?.cutoffAt)
      await syncReviewRound(args[0])

    return setSuggestionStatusUnlocked(...args)
  })
}
