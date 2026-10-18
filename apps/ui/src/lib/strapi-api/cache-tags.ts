import { API_ENDPOINTS } from "@/lib/strapi-api/endpoints"

/**
 * Cache tags for Strapi fetches, so `POST /api/revalidate` (a Strapi
 * webhook) can purge one entry or one model. Every fetch carries "strapi";
 * known endpoints add the model ("library") and, for a single entry, the
 * model plus slug or documentId ("library:british-library").
 */

/** `/libraries` → "library", from API_ENDPOINTS' content-type UIDs. */
const MODEL_BY_PATH = new Map<string, string>(
  Object.entries(API_ENDPOINTS).map(([uid, path]) => [
    path.replace(/^\//, ""),
    uid.split(".").pop()!,
  ])
)

const MODELS = new Set(MODEL_BY_PATH.values())

/** Sub-paths that are actions on a collection, not entries in it. */
const ACTION_SEGMENTS = new Set([
  "slugs",
  "continents",
  "export",
  "atlas",
  "stats",
  "search",
  "revisions",
  "browse",
])

const segments = (path: string) =>
  path.replace(/^\/+/, "").split("/").filter(Boolean)

export function modelFromPath(path: string): string | null {
  const [first] = segments(path)

  return (first && MODEL_BY_PATH.get(first)) ?? null
}

export const isCacheModel = (model: string): boolean => MODELS.has(model)

const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i

/** A tag-safe entry key, or null. */
export const entryKey = (value: unknown): string | null =>
  typeof value === "string" && SLUG_PATTERN.test(value) ? value : null

function slugFilter(params: Record<string, unknown>): string | null {
  const filters = params.filters as Record<string, unknown> | undefined
  const slug = filters?.slug
  if (typeof slug === "string") return entryKey(slug)
  if (slug && typeof slug === "object")
    return entryKey((slug as { $eq?: unknown }).$eq)

  return null
}

export function cacheTagsFor(
  path: string,
  params: Record<string, unknown>
): string[] {
  const tags = ["strapi"]
  const model = modelFromPath(path)
  if (!model) return tags
  tags.push(model)

  const [, second, third] = segments(path)
  // `/libraries/by-slug/<slug>` names its entry in the third segment.
  const entry =
    slugFilter(params) ??
    (second === "by-slug"
      ? entryKey(third)
      : second && !ACTION_SEGMENTS.has(second)
        ? entryKey(second)
        : null)
  if (entry) tags.push(`${model}:${entry}`)

  return tags
}
