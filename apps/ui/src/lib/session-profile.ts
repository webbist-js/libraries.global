import "server-only"

import { type ContributorRole, isContributorRole } from "@repo/access"
import { z } from "zod"

export const SESSION_PROFILE_TTL_MS = 60_000

export type SessionProfile = {
  contributorRole: ContributorRole
  username: string | null
  tier: string | null
  claims: string[]
}

const Body = z.object({
  contributorRole: z.string(),
  username: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  claims: z.array(z.string()).max(100).optional(),
})

// Per-process cache. On serverless each instance has its own; the TTL bounds
// how long a revoked role or claim survives anywhere (spec §3.2: 60 s).
const cache = new Map<string, { at: number; value: SessionProfile }>()

export function invalidateSessionProfile(baUserId: string): void {
  cache.delete(baUserId)
}

export async function fetchSessionProfile(
  baUserId: string
): Promise<SessionProfile | null> {
  const hit = cache.get(baUserId)
  if (hit && Date.now() - hit.at < SESSION_PROFILE_TTL_MS) return hit.value

  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/auth-bridge/session-profile?baUserId=${encodeURIComponent(baUserId)}`,
      { cache: "no-store", headers: { "X-Service-Secret": secret } }
    )
    if (!res.ok) return null
    const parsed = Body.safeParse(await res.json())
    if (!parsed.success) return null
    const d = parsed.data
    const value: SessionProfile = {
      contributorRole: isContributorRole(d.contributorRole)
        ? d.contributorRole
        : "reader",
      username: d.username ?? null,
      tier: d.tier ?? null,
      claims: d.claims ?? [],
    }
    cache.set(baUserId, { at: Date.now(), value })

    return value
  } catch {
    return null
  }
}
