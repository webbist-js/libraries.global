import { isLibraryEntityRef } from "@repo/shared-data"

const PLACE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/

/**
 * A /api/v1/places request: browse countries → regions → areas, or list the
 * libraries in one. A trailing "libraries" segment selects the list.
 */
export type TeamApiPlaceRoute =
  | { kind: "places"; country?: string; region?: string }
  | { kind: "libraries"; country: string; region?: string; area?: string }

export function teamApiPlaceRoute(
  segments: readonly string[]
): TeamApiPlaceRoute | null {
  const listing = segments.at(-1) === "libraries"
  const places = listing ? segments.slice(0, -1) : [...segments]
  if (places.some((segment) => !PLACE_SLUG.test(segment))) return null
  const [country, region, area] = places
  if (listing)
    return country && places.length <= 3
      ? { kind: "libraries", country, region, area }
      : null

  return places.length <= 2 ? { kind: "places", country, region } : null
}

const DOCUMENT_ID = "[a-z0-9]{20,32}"
const JOB_ID = "(?:reach|summary)(?::|%3A)[A-Za-z0-9_-]{22}"
/** Service, submission and analysis routes and the one method each takes. */
const RESOURCE_ROUTES: [RegExp, "GET" | "POST"][] = [
  [/^\/api\/v1\/services$/, "GET"],
  [new RegExp(`^/api/v1/services/${DOCUMENT_ID}(?:/libraries)?$`), "GET"],
  [/^\/api\/v1\/submissions\/(?:libraries|corrections)$/, "POST"],
  [new RegExp(`^/api/v1/submissions/${DOCUMENT_ID}$`), "GET"],
  [/^\/api\/v1\/analysis\/(?:summary|reach)$/, "POST"],
  [new RegExp(`^/api/v1/analysis/jobs/${JOB_ID}(?:/result)?$`, "i"), "GET"],
]

/** The method an exact machine route accepts, or null for any other path. */
export function teamApiMethod(path: string): "GET" | "POST" | null {
  if (path === "/api/v1/search/libraries") return "POST"
  for (const [pattern, method] of RESOURCE_ROUTES)
    if (pattern.test(path)) return method

  return isTeamApiPath(path) ? "GET" : null
}

/** Exact machine routes carry their own API-key authentication, including in beta. */
export function isTeamApiPath(path: string): boolean {
  if (RESOURCE_ROUTES.some(([pattern]) => pattern.test(path))) return true
  if (path === "/api/v1/search/libraries" || path === "/api/v1/libraries")
    return true
  if (path === "/api/v1/places" || path.startsWith("/api/v1/places/"))
    return (
      teamApiPlaceRoute(
        path.slice("/api/v1/places".length).split("/").filter(Boolean)
      ) !== null
    )
  const reference = /^\/api\/v1\/libraries\/([^/]+)$/.exec(path)?.[1]
  if (!reference) return false
  try {
    return isLibraryEntityRef(decodeURIComponent(reference))
  } catch {
    return false
  }
}
