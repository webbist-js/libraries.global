import { getEnvVar } from "@/lib/env-vars"

const ALLOWED_STRAPI_ENDPOINTS: Record<string, string[]> = {
  GET: [
    "api/pages",
    "api/homepage",
    "api/homepage/continents",
    "api/footer",
    "api/navbar",
    // Map exploration — public content types (read-only, published only)
    "api/continents",
    "api/countries",
    "api/regions",
    "api/libraries",
    "api/areas",
    // Custom map-pins endpoints (centroid / boundary URL only)
    "api/continents/map-pins",
    "api/libraries/map-pins",
    "api/regions/map-pins",
    "api/countries/map-pins",
    "api/areas/map-pins",
    // Events plugin — public feeds (ICS calendar + browsing)
    "api/events",
  ],
  // Strapi's own register/password endpoints are intentionally absent: all
  // account flows go through Better Auth, and exposing them here would let
  // anyone create users-permissions accounts directly.
  POST: ["api/subscribers"],
}

/**
 * Normalise a proxied path and reject anything that could escape the
 * allowlist once `fetch` resolves it: dot segments, empty segments, and
 * backslashes or percent signs (which could decode to `/` or `..` downstream).
 * Returns the cleaned path, or null if it is unsafe.
 */
export const normaliseProxyPath = (path: string): string | null => {
  const segments = path.split("/")
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      /[\\%]/.test(segment) ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001F\u007F]/.test(segment)
    ) {
      return null
    }
  }

  return segments.join("/")
}

/**
 * Check if the given Strapi Admin/API path is allowed to be accessed
 * with the provided HTTP method. Matches whole path segments only, so
 * `api/libraries` allows `api/libraries/map-pins` but not `api/libraries-x`
 * or `api/libraries/../user-profiles`.
 */
export const isStrapiEndpointAllowed = (
  path: string,
  method: string
): boolean => {
  const safePath = normaliseProxyPath(path)
  if (!safePath) return false

  return (
    ALLOWED_STRAPI_ENDPOINTS[method]?.some(
      (endpoint) => safePath === endpoint || safePath.startsWith(`${endpoint}/`)
    ) ?? false
  )
}

/**
 * Create Strapi authorization header based on the request type.
 * If the request is private, it retrieves the user token from Better Auth session.
 * If the request is public, it uses the appropriate API token based on read-only status.
 */
export const createStrapiAuthHeader = async ({
  isReadOnly,
  isPrivate,
}: {
  isReadOnly?: boolean
  isPrivate: boolean
}) => {
  if (isPrivate) {
    const userToken = await getStrapiUserTokenFromBetterAuth()

    return formatStrapiAuthorizationHeader(userToken)
  }

  const apiToken = isReadOnly
    ? getEnvVar("STRAPI_REST_READONLY_API_KEY")
    : getEnvVar("STRAPI_REST_CUSTOM_API_KEY")

  return formatStrapiAuthorizationHeader(apiToken)
}

export const formatStrapiAuthorizationHeader = (token?: string) => {
  if (!token) {
    return {} as Record<string, string>
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Get user-permission token from the Better Auth session.
 *
 * Auth is now handled natively by Strapi's Better Auth plugin via session
 * cookies — there is no separate Strapi JWT to forward. Returns undefined
 * so callers fall back to the public API token.
 */
const getStrapiUserTokenFromBetterAuth = async (): Promise<
  string | undefined
> => {
  return undefined
}
