export const SAVED_VIEW_UID = "api::saved-view.saved-view"
export const SAVED_VIEW_KINDS = ["view", "search"] as const
export type SavedViewKind = (typeof SAVED_VIEW_KINDS)[number]
/** Explorer allows 1,000 of each; nothing above that is accepted. */
export const MAX_SAVED_LIMIT = 1000
export const MAX_QUERY_LENGTH = 2000
const MAX_PARAMS = 60

const isKind = (value: unknown): value is SavedViewKind =>
  typeof value === "string" &&
  (SAVED_VIEW_KINDS as readonly string[]).includes(value)

/** A page's query string, re-serialised without empty values, or null. */
export function normaliseSavedQuery(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_QUERY_LENGTH * 2) return null
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw)
  const kept = new URLSearchParams()
  let count = 0
  for (const [key, value] of params) {
    if (!key || !value || key.length > 40 || value.length > 400) continue
    if (++count > MAX_PARAMS) return null
    kept.append(key, value)
  }
  const query = kept.toString()

  return query.length > MAX_QUERY_LENGTH ? null : query
}

export type SavedViewInput = {
  kind: SavedViewKind
  name: string
  query: string
}

/** Validates a create body: a kind, a 1–80 character name and URL state. */
export function savedViewInput(body: unknown): SavedViewInput | null {
  if (!body || typeof body !== "object") return null
  const { kind, name, query } = body as Record<string, unknown>
  if (!isKind(kind) || typeof name !== "string") return null
  const cleanName = name.replaceAll(/\s+/g, " ").trim()
  if (!cleanName || cleanName.length > 80) return null
  const cleanQuery = normaliseSavedQuery(query ?? "")
  if (cleanQuery === null) return null

  return { kind, name: cleanName, query: cleanQuery }
}

/** The account limit Next.js sends for this kind; anything malformed is 0. */
export function savedLimitOf(header: unknown): number {
  const value = typeof header === "string" ? Number(header) : Number.NaN

  return Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_SAVED_LIMIT)
    : 0
}

export { isKind as isSavedViewKind }
