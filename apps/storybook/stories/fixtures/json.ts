import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type JsonValue = Exclude<PopulatedLibraryData["openingTimes"], undefined>

/** Convert typed domain DTOs to Strapi JSON attributes without unsafe assertions. */
export function jsonFixture(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(jsonFixture)
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {}
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) result[key] = jsonFixture(child)
    }

    return result
  }
  throw new TypeError("A Storybook JSON fixture must contain only JSON values")
}
