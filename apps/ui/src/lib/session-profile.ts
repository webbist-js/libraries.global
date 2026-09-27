import "server-only"

import {
  type ContributorRole,
  isContributorRole,
  SESSION_PROFILE_MAX_CLAIMS,
} from "@repo/access"
import { z } from "zod"

export const SESSION_PROFILE_TTL_MS = 60_000

export type SessionGrant = { plan: "pro" | "team"; expiresAt: string | null }
export type SessionVerification = { expiresAt: string | null }

export type SessionProfile = {
  contributorRole: ContributorRole
  username: string | null
  tier: string | null
  claims: string[]
  grants: SessionGrant[]
  verifications: SessionVerification[]
  earnedProUntil: string | null
}

const Body = z.object({
  contributorRole: z.string(),
  username: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  claims: z.array(z.string()).max(SESSION_PROFILE_MAX_CLAIMS).optional(),
  grants: z
    .array(z.object({ plan: z.string(), expiresAt: z.string().nullable() }))
    .max(20)
    .optional(),
  verifications: z
    .array(z.object({ expiresAt: z.string().nullable() }))
    .max(20)
    .optional(),
  earnedProUntil: z.string().nullable().optional(),
})

export const SESSION_PROFILE_MAX_ENTRIES = 5000

type CacheEntry = { at: number; value: SessionProfile }
type InFlight = {
  gen: number | undefined
  promise: Promise<SessionProfile | null>
}

// Per-process cache. On serverless each instance has its own; the TTL bounds
// how long a revoked role or claim survives anywhere (spec §3.2: 60 s). Kept
// on globalThis so dev HMR and duplicate module instances share one cache.
const globalForSessionProfile = globalThis as typeof globalThis & {
  _sessionProfileCache?: Map<string, CacheEntry>
  _sessionProfileGen?: Map<string, number>
  _sessionProfileSeq?: number
  _sessionProfileInFlight?: Map<string, InFlight>
}
const cache = (globalForSessionProfile._sessionProfileCache ??= new Map())
// Generation per id, bumped on invalidate. A fetch that started before an
// invalidate must not repopulate the cache with what may be stale data.
// Values come from one monotonic sequence, so an evicted and re-created
// entry can never match a generation captured earlier.
const generations = (globalForSessionProfile._sessionProfileGen ??= new Map())
// One bridge request per id at a time: concurrent callers share it, but only
// while no invalidate has happened since it started. Entries leave when the
// request settles, so this is bounded by concurrency, not by users. Failures
// are not cached; the next call after one simply asks again.
const inFlight = (globalForSessionProfile._sessionProfileInFlight ??= new Map())

function setBounded<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key)
  if (map.size >= SESSION_PROFILE_MAX_ENTRIES) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

export function invalidateSessionProfile(baUserId: string): void {
  cache.delete(baUserId)
  const seq = (globalForSessionProfile._sessionProfileSeq ?? 0) + 1
  globalForSessionProfile._sessionProfileSeq = seq
  setBounded(generations, baUserId, seq)
}

export async function fetchSessionProfile(
  baUserId: string
): Promise<SessionProfile | null> {
  const hit = cache.get(baUserId)
  if (hit && Date.now() - hit.at < SESSION_PROFILE_TTL_MS) return hit.value

  const gen = generations.get(baUserId)
  const pending = inFlight.get(baUserId)
  if (pending && pending.gen === gen) return pending.promise

  const promise = loadSessionProfile(baUserId, gen).finally(() => {
    if (inFlight.get(baUserId)?.promise === promise) inFlight.delete(baUserId)
  })
  inFlight.set(baUserId, { gen, promise })

  return promise
}

async function loadSessionProfile(
  baUserId: string,
  gen: number | undefined
): Promise<SessionProfile | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  // The TTL runs from before the DB read, not from when the answer arrived,
  // so a slow bridge can't stretch how long a revoked role survives.
  const startedAt = Date.now()
  try {
    const res = await fetch(
      `${strapiUrl}/api/auth-bridge/session-profile?baUserId=${encodeURIComponent(baUserId)}`,
      {
        cache: "no-store",
        headers: { "X-Service-Secret": secret },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) {
      console.warn(`[session-profile] bridge returned ${res.status}`)

      return null
    }
    const parsed = Body.safeParse(await res.json())
    if (!parsed.success) {
      console.warn("[session-profile] bridge body failed validation")

      return null
    }
    const d = parsed.data
    const value: SessionProfile = {
      contributorRole: isContributorRole(d.contributorRole)
        ? d.contributorRole
        : "reader",
      username: d.username ?? null,
      tier: d.tier ?? null,
      claims: d.claims ?? [],
      grants: (d.grants ?? []).filter(
        (g): g is SessionGrant => g.plan === "pro" || g.plan === "team"
      ),
      verifications: d.verifications ?? [],
      earnedProUntil: d.earnedProUntil ?? null,
    }
    if (generations.get(baUserId) === gen) {
      setBounded(cache, baUserId, { at: startedAt, value })
    }

    return value
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown error"
    console.warn(`[session-profile] bridge request failed (${reason})`)

    return null
  }
}
