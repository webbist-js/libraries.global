import { findUnsafeContent } from "@repo/shared-data"

import { isDocumentId } from "./params"
import { ApplyRefusedError, applyToPublished } from "./publish-guard"
import { isActivityPublic } from "../../../../utils/activity-visibility"

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
  createdAt?: string
}

/**
 * Adds one request for this name: a new open suggestion, or one more
 * request (and library) on the existing one. A declined or removed name is
 * left as is; an accepted one never gets here (it's in the list by then).
 */
export async function recordSuggestion(
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
  /** Whether the viewer voted (list for a signed-in viewer only). */
  voted?: boolean
  libraries: LibraryRef[]
  /** Accepted suggestions only: the libraries still to link by hand. */
  unlinkedLibraries: UnlinkedLibrary[]
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
}

const snakeCase = (s: string) =>
  s.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()

/** The vote table and column, from the model's metadata (never hard-coded). */
function voteColumns(strapi: any): { table: string; suggestion: string } {
  const meta = strapi.db?.metadata?.get?.(VOTE)
  const schema = strapi.contentType?.(VOTE)
  const table: string =
    meta?.tableName ?? schema?.collectionName ?? "cm_option_votes"
  const suggestion: string =
    meta?.attributes?.suggestionDocumentId?.columnName ??
    snakeCase("suggestionDocumentId")

  return { table, suggestion }
}

/** Vote counts per suggestion, aggregated in the database. */
async function countVotes(
  strapi: any,
  suggestionIds: readonly string[]
): Promise<Map<string, number>> {
  const count = new Map<string, number>()
  if (suggestionIds.length === 0) return count
  const { table, suggestion } = voteColumns(strapi)
  const rows = (await strapi.db
    .connection(table)
    .select(suggestion)
    .count("* as votes")
    .whereIn(suggestion, [...suggestionIds])
    .groupBy(suggestion)) as Record<string, unknown>[]
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
  } = {}
): Promise<SuggestionView[]> {
  const filters = opts.status
    ? { status: { $eq: opts.status } }
    : opts.statuses
      ? { status: { $in: opts.statuses } }
      : undefined
  const rows = (await strapi.documents(SUGGESTION).findMany({
    ...(filters ? { filters } : {}),
    sort: { createdAt: "desc" },
    limit: 500,
  })) as SuggestionRow[]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.documentId)
  const count = await countVotes(strapi, ids)
  const mine = new Set<string>()
  if (opts.viewer) {
    const own = (await strapi.documents(VOTE).findMany({
      filters: { baUserId: { $eq: opts.viewer } },
      fields: ["suggestionDocumentId"],
      limit: 500,
    })) as { suggestionDocumentId: string }[]
    for (const v of own) mine.add(v.suggestionDocumentId)
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
  if (suggesterIds.length > 0) {
    const profiles = (await strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $in: suggesterIds } },
      fields: [
        "baUserId",
        "firstName",
        "lastName",
        "username",
        "profileVisibility",
        "publicPrefs",
      ],
      limit: 500,
    })) as {
      baUserId: string
      firstName?: string | null
      lastName?: string | null
      username?: string | null
      profileVisibility?: string
      publicPrefs?: { showActivity?: boolean } | null
    }[]
    for (const p of profiles)
      names.set(p.baUserId, isActivityPublic(p) ? displayName(p) : null)
  }

  return rows
    .map((r) => ({
      documentId: r.documentId,
      name: r.name,
      optionKey: r.optionKey,
      status: r.status,
      requests: r.requests ?? 0,
      votes: count.get(r.documentId) ?? 0,
      ...(opts.viewer ? { voted: mine.has(r.documentId) } : {}),
      libraries: r.libraries ?? [],
      unlinkedLibraries: r.unlinkedLibraries ?? [],
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
    }))
    .sort(
      (a, b) =>
        b.votes + b.requests - (a.votes + a.requests) ||
        a.name.localeCompare(b.name)
    )
}

/** Adds or removes the viewer's vote on a still-undecided suggestion. */
export async function toggleVote(
  strapi: any,
  suggestionDocumentId: string,
  baUserId: string
): Promise<{ voted: boolean; votes: number } | null> {
  if (!isDocumentId(suggestionDocumentId)) return null
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: suggestionDocumentId })) as SuggestionRow | null
  if (!suggestion || !VOTABLE_STATUSES.has(suggestion.status)) return null

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
export async function setSuggestionStatus(
  strapi: any,
  input: {
    documentId: string
    status: "reviewing" | "planned" | "removed"
    decidedBy: string
    note?: string
  }
): Promise<SuggestionRow | null> {
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: input.documentId })) as SuggestionRow | null
  if (!suggestion || !MOVE_TARGETS[input.status].has(suggestion.status))
    return null

  const data: Record<string, unknown> = { status: input.status }
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
export async function decideSuggestion(
  strapi: any,
  input: {
    documentId: string
    decision: "accept" | "decline"
    decidedBy: string
    name?: string
    note?: string
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
  const note = input.note?.trim().slice(0, 2000) || null
  const decided = { decidedAt: new Date(), decidedBy: input.decidedBy }

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
        data: { status: "declined", decisionNote: note, ...decided },
      }),
    }
  }

  if (suggestion.optionKey === "library_types") {
    // `name` lets the board tidy the wording ("Prison library" → "Prison")
    // before matching it against the schema enum.
    const candidateName = (input.name?.trim() || suggestion.name).slice(0, 80)
    const enumValues: string[] =
      strapi.contentType?.(LIBRARY)?.attributes?.libraryType?.enum ?? []
    const match = enumValues.find(
      (v) => v.toLowerCase() === candidateName.toLowerCase()
    )
    if (!match)
      return {
        ok: false,
        status: 400,
        message:
          "Add the library type to the schema first, then accept it. Mark it planned until then.",
      }

    return {
      ok: true,
      data: await strapi.documents(SUGGESTION).update({
        documentId: suggestion.documentId,
        data: {
          status: "accepted",
          name: match,
          decisionNote: note,
          ...decided,
        },
      }),
    }
  }

  const name = (input.name?.trim() || suggestion.name).slice(0, 80)
  const uid = OPTION_UIDS[suggestion.optionKey as OptionKey]
  const [existing] = await strapi.documents(uid).findMany({
    filters: { name: { $eqi: name } },
    fields: ["documentId"],
    status: "published",
    limit: 1,
  })
  const option =
    existing ??
    (await strapi
      .documents(uid)
      .create({ data: { name }, status: "published" }))

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
          [suggestion.optionKey]: {
            connect: [{ documentId: option.documentId }],
          },
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

  return {
    ok: true,
    data: await strapi.documents(SUGGESTION).update({
      documentId: suggestion.documentId,
      data: {
        status: "accepted",
        name,
        acceptedOptionDocumentId: option.documentId,
        unlinkedLibraries,
        decisionNote: note,
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
export async function createSuggestion(
  strapi: any,
  input: {
    optionKey: SuggestionList
    name: string
    description?: string | null
    baUserId: string
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

  if (input.optionKey === "library_types") {
    const enumValues: string[] =
      strapi.contentType?.(LIBRARY)?.attributes?.libraryType?.enum ?? []
    if (enumValues.some((v) => v.toLowerCase() === name.toLowerCase()))
      return {
        ok: false,
        status: 409,
        message: "That option is already in the lists.",
      }
  } else {
    const uid = OPTION_UIDS[input.optionKey]
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
  }

  const [existingSuggestion] = (await strapi.documents(SUGGESTION).findMany({
    filters: { optionKey: { $eq: input.optionKey }, nameKey: { $eq: nameKey } },
    limit: 1,
  })) as SuggestionRow[]
  if (existingSuggestion) {
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
  const created = (await strapi.documents(SUGGESTION).create({
    data: {
      name,
      nameKey,
      optionKey: input.optionKey,
      status: "open",
      requests: 0,
      libraries: [],
      submissionIds: [],
      description,
      suggestedBy: input.baUserId,
    },
  })) as SuggestionRow
  const vote = await toggleVote(strapi, created.documentId, input.baUserId)

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
