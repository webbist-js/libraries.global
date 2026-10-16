export type DiscussionState = "pending" | "visible" | "rejected" | "removed"
export type Subject = {
  id: string
  name: string
  slug: string
  description?: string
  languages?: string[]
  visibility: string
  createPolicy: string
}
export type DiscussionTarget = {
  uid: string
  documentId: string
  locale?: string
}
export type DiscussionRecord = {
  id: string
  body: string
  language: string
  state: DiscussionState
  version: number
  author: { name: string; slug?: string; url?: string }
  title?: string
  subjectId?: string
  threadId?: string
  parentId?: string | null
  locked?: boolean
  pinned?: boolean
  createdAt?: string
  target?: { title: string; url: string }
  pendingRevision?: {
    id: string
    body: string
    title?: string
    baseVersion: number
  }
}
export type DiscussionList<T> = { data: T[]; nextOffset?: number | null }
export type DiscussionRevision = {
  id: string
  recordType: "thread" | "reply"
  recordId: string
  threadId: string
  title?: string
  body: string
  previousBody?: string
  previousTitle?: string
  baseVersion: number
  currentVersion: number
  threadTitle?: string
}
export type DiscussionReport = {
  id: string
  recordType: "thread" | "reply"
  recordId: string
  threadId: string
  reason: string
  version: number
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
