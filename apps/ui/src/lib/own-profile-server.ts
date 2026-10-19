import "server-only"

import { cache } from "react"

import { avatarSrc } from "@/lib/avatar"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import type { UserProfile } from "@/lib/types/profile"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** The signed-in user, as the session gives it. */
type SessionUser = { id: string; email: string; name?: string | null }

/**
 * The owner view of the signed-in user's profile, as Strapi's
 * `GET /api/user-profiles/me` returns it: every field the owner may see
 * (notification settings included), avatar, languages, follows, claimed
 * libraries and badges. Never carries `baUserId`. `username` is null until
 * onboarding sets it.
 */
export type OwnProfile = UserProfile

export type OwnProfileLookup =
  | { ok: true; profile: OwnProfile }
  | { ok: false; reason: "not_found" | "unavailable" }

/**
 * One bridge read per request: the header, layout and page of a render share
 * it through React `cache`. Route handlers call straight through.
 */
const lookupOwnProfile = cache(
  async (
    id: string,
    email: string,
    name: string
  ): Promise<OwnProfileLookup> => {
    if (!process.env.STRAPI_BRIDGE_SECRET)
      return { ok: false, reason: "unavailable" }
    try {
      const res = await fetch(`${STRAPI}/api/user-profiles/me`, {
        cache: "no-store",
        headers: bridgeUserHeaders({ id, email, name }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.status === 404) return { ok: false, reason: "not_found" }
      if (!res.ok) return { ok: false, reason: "unavailable" }
      const json = (await res.json()) as { data?: OwnProfile | null }

      return json.data
        ? { ok: true, profile: json.data }
        : { ok: false, reason: "not_found" }
    } catch {
      return { ok: false, reason: "unavailable" }
    }
  }
)

/**
 * The signed-in user's own profile, read through the bridge-secret
 * `/api/user-profiles/me` route keyed on the Better Auth id from the session.
 * `baUserId` is private, so the public REST filter on it can't be used.
 * Use this when the caller must tell "no profile" from "Strapi is down".
 */
export function readOwnProfile(user: SessionUser): Promise<OwnProfileLookup> {
  return lookupOwnProfile(user.id, user.email, user.name ?? "")
}

/** The signed-in user's own profile, or null when missing or unreachable. */
export async function fetchOwnProfile(
  user: SessionUser
): Promise<OwnProfile | null> {
  const lookup = await readOwnProfile(user)

  return lookup.ok ? lookup.profile : null
}

/** The signed-in user's own profile, as far as the header and forms need it. */
export type OwnProfileSnippet = {
  username: string
  avatarUrl: string | null
  profileBackground?: UserProfile["profileBackground"]
  isVerifiedLibrarian: boolean
  /** Language codes from the profile's languages, in profile order. */
  languages: string[]
}

/**
 * The header's slice of the signed-in user's profile (same bridge read as
 * `fetchOwnProfile`). Null when there's no username yet or the bridge is down.
 */
export async function fetchOwnProfileSnippet(
  user: SessionUser
): Promise<OwnProfileSnippet | null> {
  const p = await fetchOwnProfile(user)
  if (!p?.username) return null

  return {
    username: p.username,
    // Passed to the browser: the asset proxy form, never the Strapi origin.
    avatarUrl: avatarSrc(p.avatar),
    profileBackground: p.profileBackground,
    isVerifiedLibrarian: p.isVerifiedLibrarian === true,
    languages: (p.languages ?? [])
      .map((l) => l?.code as unknown)
      .filter((c): c is string => typeof c === "string" && c.length > 0),
  }
}
