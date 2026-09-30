import { isRecordCorrection, OPTION_COLLECTIONS } from "./library-record"
import { isDocumentId } from "./params"

/**
 * What a moderator needs to judge a record correction, read from Strapi
 * rather than trusted from the contributor: the library's live values for
 * each changed field, and the names behind any option documentIds.
 */

const LIBRARY = "api::library.library"

/** Keys in `fields` that describe the submission, not library fields. */
export const RECORD_META_KEYS = new Set([
  "kind",
  "previous",
  "category",
  "libraryName",
  "suggestedOptions",
])

export type RecordReview = {
  current: Record<string, unknown>
  names: Record<string, string>
}

/** documentIds anywhere in a relation change: a list, or connect/disconnect. */
function relationIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(isDocumentId)
  if (!raw || typeof raw !== "object") return []
  const { connect, disconnect } = raw as Record<string, unknown>

  return [connect, disconnect].flatMap((v) =>
    Array.isArray(v) ? v.filter(isDocumentId) : []
  )
}

type ReviewSubmission = {
  fields?: unknown
  targetDocumentId?: string | null
  targetSlug?: string | null
}

/**
 * Lookups shared across a queue page (see `preloadRecordReviews`), so a
 * page of corrections costs one library query and one per option list
 * rather than one round trip per row.
 */
export type PreloadedReview = {
  /** Libraries by documentId and by slug. */
  libraries: Map<string, Record<string, unknown>>
  /** Option names by relation key, then documentId. */
  options: Map<string, Map<string, string>>
}

/** The keys of a record correction, split into scalars and option relations. */
function reviewKeys(fields: Record<string, unknown>) {
  const keys = Object.keys(fields).filter((k) => !RECORD_META_KEYS.has(k))

  return {
    relations: keys.filter((k) => k in OPTION_COLLECTIONS),
    scalars: keys.filter(
      (k) =>
        !(k in OPTION_COLLECTIONS) &&
        /^[a-zA-Z]+$/.test(k) &&
        k !== "lat" &&
        k !== "lng"
    ),
  }
}

/**
 * Loads, in one query per collection, everything `recordReview` needs for
 * these submissions: every targeted library (with the option relations any
 * of them touches) and the name of every option id any of them mentions.
 */
export async function preloadRecordReviews(
  strapi: any,
  submissions: readonly ReviewSubmission[]
): Promise<PreloadedReview> {
  const preloaded: PreloadedReview = {
    libraries: new Map(),
    options: new Map(),
  }
  const rows = submissions.filter((s) => isRecordCorrection(s.fields))
  if (rows.length === 0) return preloaded

  const scalars = new Set<string>()
  const relations = new Set<string>()
  const wanted = new Map<string, Set<string>>()
  const ids = new Set<string>()
  const slugs = new Set<string>()
  for (const s of rows) {
    const fields = s.fields as Record<string, unknown>
    const k = reviewKeys(fields)
    k.scalars.forEach((x) => scalars.add(x))
    for (const rel of k.relations) {
      relations.add(rel)
      const set = wanted.get(rel) ?? new Set<string>()
      relationIds(fields[rel]).forEach((id) => set.add(id))
      wanted.set(rel, set)
    }
    if (s.targetDocumentId) ids.add(s.targetDocumentId)
    else if (s.targetSlug) slugs.add(s.targetSlug)
  }

  const query = {
    fields: ["documentId", "slug", ...scalars],
    populate: Object.fromEntries(
      [...relations].map((k) => [k, { fields: ["documentId", "name"] }])
    ),
  }
  const or = [
    ...(ids.size ? [{ documentId: { $in: [...ids] } }] : []),
    ...(slugs.size ? [{ slug: { $in: [...slugs] } }] : []),
  ]
  if (or.length > 0) {
    try {
      const libraries = (await strapi.documents(LIBRARY).findMany({
        filters: or.length === 1 ? or[0] : { $or: or },
        ...query,
        limit: ids.size + slugs.size,
      })) as Record<string, unknown>[]
      for (const lib of libraries) {
        if (typeof lib.documentId === "string")
          preloaded.libraries.set(lib.documentId, lib)
        if (typeof lib.slug === "string") preloaded.libraries.set(lib.slug, lib)
      }
    } catch {
      // Reviews degrade to "no live values"; the row is still listed.
    }
  }

  for (const [rel, set] of wanted) {
    const names = new Map<string, string>()
    preloaded.options.set(rel, names)
    for (const lib of preloaded.libraries.values()) {
      const linked = Array.isArray(lib[rel])
        ? (lib[rel] as { documentId?: string; name?: string }[])
        : []
      for (const o of linked)
        if (o.documentId && o.name) names.set(o.documentId, o.name)
    }
    const unknown = [...set].filter((id) => !names.has(id))
    if (unknown.length === 0) continue
    const found = (await strapi.documents(OPTION_COLLECTIONS[rel]).findMany({
      filters: { documentId: { $in: unknown } },
      fields: ["documentId", "name"],
      limit: unknown.length,
    })) as { documentId?: string; name?: string }[]
    for (const o of found)
      if (o.documentId && o.name) names.set(o.documentId, o.name)
  }

  return preloaded
}

export async function recordReview(
  strapi: any,
  submission: ReviewSubmission,
  preloaded?: PreloadedReview
): Promise<RecordReview | null> {
  if (!isRecordCorrection(submission.fields)) return null
  const fields = submission.fields as Record<string, unknown>
  const { relations, scalars } = reviewKeys(fields)

  let library: Record<string, unknown> | null = null
  if (preloaded) {
    library =
      (submission.targetDocumentId
        ? preloaded.libraries.get(submission.targetDocumentId)
        : submission.targetSlug
          ? preloaded.libraries.get(submission.targetSlug)
          : null) ?? null
  } else {
    const query = {
      fields: ["documentId", ...scalars],
      populate: Object.fromEntries(
        relations.map((k) => [k, { fields: ["documentId", "name"] }])
      ),
    }
    try {
      if (submission.targetDocumentId)
        library = await strapi
          .documents(LIBRARY)
          .findOne({ documentId: submission.targetDocumentId, ...query })
      else if (submission.targetSlug)
        [library] = await strapi.documents(LIBRARY).findMany({
          filters: { slug: { $eq: submission.targetSlug } },
          ...query,
          limit: 1,
        })
    } catch {
      library = null
    }
  }

  const names: Record<string, string> = {}
  const current: Record<string, unknown> = {}
  for (const key of scalars)
    if (library && key in library) current[key] = library[key]
  for (const key of relations) {
    const linked = Array.isArray(library?.[key])
      ? (library![key] as { documentId?: string; name?: string }[])
      : []
    for (const o of linked)
      if (o.documentId && o.name) names[o.documentId] = o.name
    current[key] = linked.map((o) => o.documentId).filter(Boolean)

    const unknown = relationIds(fields[key]).filter((id) => !names[id])
    if (unknown.length === 0) continue
    if (preloaded) {
      const known = preloaded.options.get(key)
      for (const id of unknown) {
        const name = known?.get(id)
        if (name) names[id] = name
      }
      continue
    }
    const found = (await strapi.documents(OPTION_COLLECTIONS[key]).findMany({
      filters: { documentId: { $in: unknown } },
      fields: ["documentId", "name"],
      limit: unknown.length,
    })) as { documentId?: string; name?: string }[]
    for (const o of found)
      if (o.documentId && o.name) names[o.documentId] = o.name
  }

  return { current, names }
}

export type TopicReview = {
  topic: { name: string | null; slug: string | null; status: string | null }
}

/**
 * What a `topic_suggestion`'s `targetDocumentId` points at, so the moderator
 * sees the topic they're approving. One query for the whole page.
 */
export async function preloadTopicReviews(
  strapi: any,
  submissions: readonly {
    submissionType?: string
    targetEntityType?: string | null
    targetDocumentId?: string | null
  }[]
): Promise<Map<string, TopicReview>> {
  const out = new Map<string, TopicReview>()
  const ids = [
    ...new Set(
      submissions.flatMap((s) =>
        s.submissionType === "topic_suggestion" &&
        s.targetEntityType === "topic" &&
        isDocumentId(s.targetDocumentId)
          ? [s.targetDocumentId]
          : []
      )
    ),
  ]
  if (ids.length === 0) return out
  try {
    const topics = (await strapi.documents("api::topic.topic").findMany({
      filters: { documentId: { $in: ids } },
      fields: ["documentId", "name", "slug", "status"],
      limit: ids.length,
    })) as {
      documentId: string
      name?: string
      slug?: string
      status?: string
    }[]
    for (const t of topics)
      out.set(t.documentId, {
        topic: {
          name: t.name ?? null,
          slug: t.slug ?? null,
          status: t.status ?? null,
        },
      })
  } catch {
    // The row is still listed, without the topic's name.
  }

  return out
}
