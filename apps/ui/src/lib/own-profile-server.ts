import "server-only"

import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** The signed-in user's own profile, as far as the header and forms need it. */
export type OwnProfileSnippet = {
  username: string
  avatarUrl: string | null
  isVerifiedLibrarian: boolean
  /** Language codes from the profile's languages, in profile order. */
  languages: string[]
}

/**
 * The signed-in user's profile, read through the owner-scoped by-username
 * route with the bridge secret (the settings page uses the same route).
 * `baUserId` is private, so the public REST filter on it can't be used;
 * the username comes from the session instead. Null when there's no
 * username yet or the bridge is down.
 */
export async function fetchOwnProfileSnippet(user: {
  id: string
  username?: string | null
}): Promise<OwnProfileSnippet | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  const username = user.username
  if (!secret || !username) return null
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}?ownerBaUserId=${encodeURIComponent(user.id)}`,
      {
        cache: "no-store",
        headers: { "X-Service-Secret": secret },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: {
        username?: string | null
        isVerifiedLibrarian?: boolean | null
        avatar?: { url?: string | null } | null
        languages?: { code?: unknown }[] | null
      }
    }
    const p = json.data
    if (!p) return null

    return {
      username: p.username ?? username,
      // Passed to the browser: the asset proxy form, never the Strapi origin.
      avatarUrl: formatStrapiMediaUrlForClient(p.avatar?.url) ?? null,
      isVerifiedLibrarian: p.isVerifiedLibrarian === true,
      languages: (p.languages ?? [])
        .map((l) => l?.code)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    }
  } catch {
    return null
  }
}
