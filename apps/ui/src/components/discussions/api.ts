import type {
  DiscussionImage,
  DiscussionRecord,
  DiscussionList,
  PublicAuthor,
} from "strapi-plugin-discussions/types"

export type {
  DiscussionContextFeed,
  DiscussionContextLink,
  DiscussionState,
  DiscussionImage,
  DiscussionRecord,
  DiscussionList,
  DiscussionRevision,
  DiscussionAuditEvent,
  DiscussionReport,
  DiscussionRestriction,
  DiscussionQuote,
  PublicAuthor,
  DiscussionSubject as Subject,
  Target as DiscussionTarget,
} from "strapi-plugin-discussions/types"

export type DiscussionLanguage = { code: string; name: string }

export async function uploadDiscussionImage(
  file: File,
  subjectId: string,
  altText: string,
  caption: string
): Promise<DiscussionImage> {
  const form = new FormData()
  form.set("file", file)
  form.set("subjectId", subjectId)
  form.set("altText", altText)
  form.set("caption", caption)
  const response = await fetch("/api/discussions/attachments", {
    method: "POST",
    body: form,
    credentials: "same-origin",
    cache: "no-store",
  })
  if (!response.ok) throw new DiscussionRequestError(response.status)

  return response.json() as Promise<DiscussionImage>
}
export function discussionAuthor(
  author: DiscussionRecord["author"] | null | undefined,
  name = "Community member"
): PublicAuthor {
  return author ?? { name }
}
export function discussionRecordState(record: DiscussionRecord) {
  return record.state === "pending" &&
    record.latestRevision?.state === "changes_requested"
    ? ("changesRequested" as const)
    : record.state
}

export type DiscussionFilters = {
  contextType?: string
  contextId?: string
  contextLocale?: string
  subjectId: string
  language: string
  view: "latest" | "unanswered" | "following"
  q: string
}
export function discussionFilters(query: URLSearchParams): DiscussionFilters {
  const view = query.get("view")

  return {
    contextType: ["libraries", "drives"].includes(query.get("context") ?? "")
      ? query.get("context")!
      : "",
    contextId: (query.get("entity") ?? "").slice(0, 128),
    contextLocale: (query.get("contextLocale") ?? "").slice(0, 35),
    subjectId: (query.get("subject") ?? "").slice(0, 64),
    language: (query.get("lang") ?? "").slice(0, 35),
    view: view === "unanswered" || view === "following" ? view : "latest",
    q: (query.get("q") ?? "").slice(0, 180),
  }
}
export function discussionThreadQuery(filters: DiscussionFilters, offset = 0) {
  return new URLSearchParams({
    ...(filters.contextType ? { contextType: filters.contextType } : {}),
    ...(filters.contextId && filters.contextType
      ? {
          contextUid:
            filters.contextType === "drives"
              ? "api::drive.drive"
              : "api::library.library",
          contextId: filters.contextId,
          ...(filters.contextLocale
            ? { contextLocale: filters.contextLocale }
            : {}),
        }
      : {}),
    limit: "20",
    ...(offset ? { offset: String(offset) } : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.view !== "latest" ? { view: filters.view } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  }).toString()
}

/** Parent-first ordering is deterministic even when a child arrives on a later page. */
export function orderedDiscussionReplies(
  records: DiscussionRecord[]
): { record: DiscussionRecord; depth: number; parent?: DiscussionRecord }[] {
  const byId = new Map(records.map((record) => [record.id, record]))
  const children = new Map<string, DiscussionRecord[]>()
  for (const record of records)
    if (
      record.parentId &&
      byId.has(record.parentId) &&
      record.parentId !== record.id
    )
      children.set(record.parentId, [
        ...(children.get(record.parentId) ?? []),
        record,
      ])
  const result: {
    record: DiscussionRecord
    depth: number
    parent?: DiscussionRecord
  }[] = []
  const seen = new Set<string>()
  const visit = (record: DiscussionRecord, depth: number) => {
    if (seen.has(record.id)) return
    seen.add(record.id)
    result.push({
      record,
      depth: Math.min(depth, 3),
      ...(record.parentId && byId.has(record.parentId)
        ? { parent: byId.get(record.parentId) }
        : {}),
    })
    for (const child of children.get(record.id) ?? []) visit(child, depth + 1)
  }
  for (const record of records)
    if (!record.parentId || !byId.has(record.parentId))
      visit(record, record.parentId ? 1 : 0)
  for (const record of records) visit(record, 0)

  return result
}

/** Owner-only proposals share the conversation order without changing public reply counts. */
export function discussionReplyFlow(
  published: DiscussionRecord[],
  own: DiscussionRecord[]
) {
  const publicIds = new Set(published.map((record) => record.id))
  const owned = new Map(own.map((record) => [record.id, record]))
  const records = [
    ...published.map((record) => owned.get(record.id) ?? record),
    ...own.filter(
      (record) =>
        !publicIds.has(record.id) &&
        ["pending", "rejected"].includes(record.state)
    ),
  ]
  records.sort((a, b) => {
    const first = Date.parse(a.createdAt ?? ""),
      second = Date.parse(b.createdAt ?? "")

    return Number.isFinite(first) && Number.isFinite(second)
      ? first - second
      : 0
  })

  return orderedDiscussionReplies(records)
}

export function mergeDiscussionRecords(
  ...pages: readonly DiscussionRecord[][]
) {
  return [
    ...new Map(pages.flat().map((record) => [record.id, record])).values(),
  ]
}

/** Reload the reader's current window rather than dropping a reply target on a later page. */
export async function loadDiscussionReplyPages(
  threadId: string,
  count: number
) {
  const pages = await Promise.all(
    Array.from({ length: count }, (_, page) =>
      discussionRequest<DiscussionList<DiscussionRecord>>(
        `threads/${encodeURIComponent(threadId)}/replies?limit=20${page ? `&offset=${page * 20}` : ""}`
      )
    )
  )

  return {
    data: mergeDiscussionRecords(...pages.map((page) => page.data)),
    nextOffset: pages.at(-1)?.nextOffset ?? null,
  }
}

export class DiscussionRequestError extends Error {
  constructor(readonly status: number) {
    super(`Discussion request failed (${status})`)
  }
}

/** Browser requests always cross the host's authenticated same-origin bridge. */
export async function discussionRequest<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`/api/discussions/${path}`, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  })
  if (!response.ok) throw new DiscussionRequestError(response.status)

  return response.json() as Promise<T>
}

export function discussionErrorKey(error: unknown) {
  if (!(error instanceof DiscussionRequestError)) return "error"
  if (error.status === 409) return "conflict"
  if (error.status === 404) return "unavailable"
  if (error.status === 401) return "signIn"
  if (error.status === 403) return "notAllowed"
  if (error.status === 400) return "invalidInput"
  if (error.status === 429) return "rateLimited"

  return "error"
}

/** Defensive presentation even if a future host projects an unsafe profile URL. */
export function discussionHref(value?: string): string | null {
  if (
    !value ||
    Array.from(value).some((char) => {
      const code = char.codePointAt(0) ?? 0

      return code < 32 || code === 127
    })
  )
    return null
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return value
  try {
    const url = new URL(value)

    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
