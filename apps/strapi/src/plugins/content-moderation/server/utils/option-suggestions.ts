import { isDocumentId } from "./params"
import { ApplyRefusedError, applyToPublished } from "./publish-guard"

/**
 * New accessibility features, services and amenities that contributors
 * asked for ("suggest a new one"). A suggestion is recorded when a
 * moderator approves the correction that carried it, so only vetted names
 * reach the list. Signed-in contributors vote on open suggestions in the
 * Contribute hub; the editorial board accepts or declines them monthly in
 * the moderation plugin. Accepting adds the option to its list and links it
 * to every library that asked for it.
 */

export const SUGGESTION = "plugin::content-moderation.option-suggestion"
export const VOTE = "plugin::content-moderation.option-vote"
const LIBRARY = "api::library.library"

export const OPTION_UIDS = {
  accessibility: "api::accessibility.accessibility",
  amenities: "api::amenity.amenity",
  services: "api::service.service",
} as const

export type OptionKey = keyof typeof OPTION_UIDS

export const isOptionKey = (v: unknown): v is OptionKey =>
  typeof v === "string" && v in OPTION_UIDS

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

type SuggestionRow = {
  documentId: string
  name: string
  nameKey: string
  optionKey: OptionKey
  status: "open" | "accepted" | "declined"
  requests?: number | null
  libraries?: LibraryRef[] | null
  submissionIds?: string[] | null
  acceptedOptionDocumentId?: string | null
  unlinkedLibraries?: UnlinkedLibrary[] | null
  decidedAt?: string | null
  decidedBy?: string | null
  decisionNote?: string | null
  createdAt?: string
}

/**
 * Adds one request for this name: a new open suggestion, or one more
 * request (and library) on the existing one. A declined name is left
 * declined; an accepted one never gets here (it's in the list by then).
 */
export async function recordSuggestion(
  strapi: any,
  input: {
    optionKey: OptionKey
    name: string
    library: LibraryRef
    submissionId: string
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
      },
    })

    return "created"
  }
  if (existing.status === "declined") return "declined"

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
  optionKey: OptionKey
  status: SuggestionRow["status"]
  requests: number
  votes: number
  /** Whether the viewer voted (list for a signed-in viewer only). */
  voted?: boolean
  libraries: LibraryRef[]
  /** Accepted suggestions only: the libraries still to link by hand. */
  unlinkedLibraries: UnlinkedLibrary[]
  createdAt?: string
  decidedAt?: string | null
  decidedBy?: string | null
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

/** Suggestions with their vote counts, most wanted first. */
export async function listSuggestions(
  strapi: any,
  opts: { status?: SuggestionRow["status"]; viewer?: string } = {}
): Promise<SuggestionView[]> {
  const rows = (await strapi.documents(SUGGESTION).findMany({
    ...(opts.status ? { filters: { status: { $eq: opts.status } } } : {}),
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
      createdAt: r.createdAt,
      decidedAt: r.decidedAt ?? null,
      decidedBy: r.decidedBy ?? null,
      decisionNote: r.decisionNote ?? null,
    }))
    .sort(
      (a, b) =>
        b.votes + b.requests - (a.votes + a.requests) ||
        a.name.localeCompare(b.name)
    )
}

/** Adds or removes the viewer's vote on an open suggestion. */
export async function toggleVote(
  strapi: any,
  suggestionDocumentId: string,
  baUserId: string
): Promise<{ voted: boolean; votes: number } | null> {
  if (!isDocumentId(suggestionDocumentId)) return null
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: suggestionDocumentId })) as SuggestionRow | null
  if (!suggestion || suggestion.status !== "open") return null

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

/**
 * The editorial board's decision. Accepting finds the option by name (or
 * creates it, published), links it to every library that asked for it,
 * and publishes those libraries. `name` lets the board tidy the wording.
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
): Promise<SuggestionRow | null> {
  const suggestion = (await strapi
    .documents(SUGGESTION)
    .findOne({ documentId: input.documentId })) as SuggestionRow | null
  if (!suggestion || suggestion.status !== "open") return null
  const note = input.note?.trim().slice(0, 2000) || null
  const decided = { decidedAt: new Date(), decidedBy: input.decidedBy }

  if (input.decision === "decline")
    return strapi.documents(SUGGESTION).update({
      documentId: suggestion.documentId,
      data: { status: "declined", decisionNote: note, ...decided },
    })

  const name = (input.name?.trim() || suggestion.name).slice(0, 80)
  const uid = OPTION_UIDS[suggestion.optionKey]
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

  return strapi.documents(SUGGESTION).update({
    documentId: suggestion.documentId,
    data: {
      status: "accepted",
      name,
      acceptedOptionDocumentId: option.documentId,
      unlinkedLibraries,
      decisionNote: note,
      ...decided,
    },
  })
}
