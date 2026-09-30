/**
 * Query helpers shared by the public events handlers.
 *
 * Notes for callers:
 * - `strapi.documents().findMany` ignores `pagination: {}` in Strapi 5:
 *   use `start`/`limit` (see `pageWindow`) and always a stable sort
 *   (`PUBLIC_EVENT_SORT`), so pages don't drift between requests.
 * - Every public read spreads `publicEventFilters()` so an event that is
 *   awaiting review, cancelled or postponed never leaks through a handler
 *   that forgot to filter.
 */

/** Statuses a visitor may see. Must be a subset of the schema's `status` enum. */
export const PUBLIC_EVENT_STATUSES = ["upcoming", "ongoing"] as const

/** The attributes a visitor may see. Sync internals (credentialId, syncHash, externalId, importedAt, lastSeenAt, pendingReview) are never selected. */
export const PUBLIC_EVENT_FIELDS = [
  "title",
  "description",
  "summary",
  "url",
  "imageUrl",
  "startTime",
  "endTime",
  "allDay",
  "timezone",
  "eventType",
  "audience",
  "tags",
  "isFree",
  "priceMin",
  "priceMax",
  "capacity",
  "status",
  "sourceProvider",
  "libraryEntityRef",
] as const

/** A stable order: `id` breaks ties between events that start together. */
export const PUBLIC_EVENT_SORT = ["startTime:asc", "id:asc"] as const

export type PublicEventFilters = Record<string, unknown> & {
  pendingReview: false
  status: { $in: readonly string[] }
}

/** Filters every public read must carry. The `extra` filters can't override them. */
export function publicEventFilters(
  extra: Record<string, unknown> = {}
): PublicEventFilters {
  return {
    ...extra,
    pendingReview: false,
    status: { $in: PUBLIC_EVENT_STATUSES },
  }
}

export interface ClampOptions {
  def: number
  min: number
  max: number
}

/**
 * Parse a query value as a bounded integer. Anything that isn't a plain
 * numeric string or number (arrays from `?limit[]=`, objects, `NaN`, empty)
 * yields `def`; out-of-range values are clamped; decimals are truncated.
 */
export function clampInt(
  value: unknown,
  { def, min, max }: ClampOptions
): number {
  let n: number
  if (typeof value === "number") n = value
  else if (typeof value === "string" && value.trim() !== "") n = Number(value)
  else return def

  if (Number.isNaN(n)) return def
  if (n === Number.POSITIVE_INFINITY) return max
  if (n === Number.NEGATIVE_INFINITY) return min

  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export interface PageWindow {
  start: number
  limit: number
  page: number
}

/** `?page=&limit=` → `{ start, limit, page }` with limit in `[1, max]` and page in `[1, 10000]`. */
export function pageWindow(
  query: Record<string, unknown>,
  { def, max }: { def: number; max: number }
): PageWindow {
  const limit = clampInt(query.limit, { def, min: 1, max })
  const page = clampInt(query.page, { def: 1, min: 1, max: 10_000 })

  return { start: (page - 1) * limit, limit, page }
}

/** A query value only when it is a non-empty string (never an array or object). */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

/** A query value as an ISO timestamp, only when `Date.parse` accepts it. */
export function parseIsoDate(value: unknown): string | undefined {
  const s = asString(value)
  if (!s) return undefined
  const ms = Date.parse(s)

  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString()
}

/** `?type=talk,workshop` → `["talk", "workshop"]`; non-strings and empties → `[]`. */
export function parseTypeList(value: unknown): string[] {
  const s = asString(value)
  if (!s) return []

  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

const SQLITE_CLIENTS = new Set(["sqlite", "sqlite3", "better-sqlite3"])

/** True when Strapi's database is sqlite (tests/dev), for the few raw SQL branches. */
export function isSqlite(strapi: any): boolean {
  const client =
    strapi?.db?.dialect?.client ??
    strapi?.db?.config?.connection?.client ??
    strapi?.db?.connection?.client?.config?.client
  const name = typeof client === "string" ? client : client?.dialect

  return SQLITE_CLIENTS.has(String(name ?? "").toLowerCase())
}

/** `EXTRACT(DOW/HOUR FROM start_time)` on Postgres, `strftime` on sqlite. */
export function dowHourSql(strapi: any): { dow: string; hour: string } {
  if (isSqlite(strapi)) {
    return {
      dow: "CAST(strftime('%w', start_time) AS INTEGER)",
      hour: "CAST(strftime('%H', start_time) AS INTEGER)",
    }
  }

  return {
    dow: "EXTRACT(DOW FROM start_time)::int",
    hour: "EXTRACT(HOUR FROM start_time)::int",
  }
}
