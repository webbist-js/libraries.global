import { isLibraryEntityRef } from "@repo/shared-data"

/** Exact machine routes carry their own API-key authentication, including in beta. */
export function isTeamApiPath(path: string) {
  if (path === "/api/v1/search/libraries" || path === "/api/v1/libraries")
    return true
  const reference = /^\/api\/v1\/libraries\/([^/]+)$/.exec(path)?.[1]
  if (!reference) return false
  try {
    return isLibraryEntityRef(decodeURIComponent(reference))
  } catch {
    return false
  }
}
