import type { Core } from "@strapi/strapi"
import { errors } from "@strapi/utils"

import { ROADMAP, SUGGESTION_PREFIX } from "../utils/roadmap"

/**
 * Votes and discussions attach to a roadmap item's key, so keys must be
 * unique across features and dataset imports and never collide with the
 * `suggestion-` namespace. The schema checks each key's format.
 */
export function roadmapKeyProblem(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  const items = ["features", "dataImports"].flatMap((field) =>
    Array.isArray(record[field]) ? (record[field] as unknown[]) : []
  )
  const seen = new Set<string>()
  for (const item of items) {
    const key = (item as { key?: unknown } | null)?.key
    if (typeof key !== "string") continue
    if (key.startsWith(SUGGESTION_PREFIX))
      return `Roadmap keys cannot start with "${SUGGESTION_PREFIX}" (${key}).`
    if (seen.has(key))
      return `Each roadmap item needs its own key; "${key}" is used twice.`
    seen.add(key)
  }

  return null
}

export function registerRoadmapKeyMiddleware({
  strapi,
}: {
  strapi: Core.Strapi
}): void {
  strapi.documents.use(async (context, next) => {
    if (
      context.uid === ROADMAP &&
      (context.action === "create" || context.action === "update")
    ) {
      const problem = roadmapKeyProblem(
        (context.params as { data?: unknown } | undefined)?.data
      )
      if (problem) throw new errors.ValidationError(problem)
    }

    return next()
  })
}
