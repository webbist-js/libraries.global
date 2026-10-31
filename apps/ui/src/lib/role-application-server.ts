import "server-only"

import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import type { MySubmissionRow } from "@/lib/role-application"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/**
 * The signed-in user's submissions (Strapi returns the newest 100), via the
 * moderation bridge. An empty list when the bridge is down: callers then
 * treat the user as not yet eligible, and Strapi still decides on submit.
 */
export async function fetchMySubmissions(user: {
  id: string
  email: string
  name?: string | null
}): Promise<MySubmissionRow[]> {
  return (await fetchMySubmissionsResult(user)) ?? []
}

/** Preserve unavailable state for workspaces that must not suggest starting again. */
export async function fetchMySubmissionsResult(user: {
  id: string
  email: string
  name?: string | null
}): Promise<MySubmissionRow[] | null> {
  if (!process.env.STRAPI_BRIDGE_SECRET) return null
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: bridgeUserHeaders(user),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: unknown }

    return Array.isArray(json.data) ? (json.data as MySubmissionRow[]) : null
  } catch {
    return null
  }
}

/** A whole, non-negative count, or null when it isn't one. */
function countOf(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.floor(v))
    : null
}

/**
 * The signed-in user's submission counts from Strapi's accepted-count
 * route: `accepted` (approved, not counting Role Applications: what
 * applying for an editor role needs), and the pending quota as the
 * submission policy counts it (`pending` waiting for review, at most
 * `pendingLimit`). Accepted is 0 and the quota null when the bridge is
 * down; Strapi still decides on submit.
 */
export async function fetchSubmissionCounts(user: {
  id: string
  email: string
  name?: string | null
}): Promise<{
  accepted: number
  pending: number | null
  pendingLimit: number | null
}> {
  const none = { accepted: 0, pending: null, pendingLimit: null }
  if (!process.env.STRAPI_BRIDGE_SECRET) return none
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/my/accepted-count`,
      { cache: "no-store", headers: bridgeUserHeaders(user) }
    )
    if (!res.ok) return none
    const json = (await res.json()) as {
      data?: { accepted?: unknown; pending?: unknown; pendingLimit?: unknown }
    }
    const pending = countOf(json.data?.pending)
    const pendingLimit = countOf(json.data?.pendingLimit)

    return {
      accepted: countOf(json.data?.accepted) ?? 0,
      // Both or neither: a quota needs its limit.
      pending: pendingLimit === null ? null : pending,
      pendingLimit: pending === null ? null : pendingLimit,
    }
  } catch {
    return none
  }
}

/**
 * How many of the signed-in user's submissions were approved, not counting
 * Role Applications: what applying for an editor role needs. Strapi counts
 * them all (`/submissions/my` only returns the newest 100). 0 when the bridge
 * is down; Strapi still decides on submit.
 */
export async function fetchAcceptedCount(user: {
  id: string
  email: string
  name?: string | null
}): Promise<number> {
  return (await fetchSubmissionCounts(user)).accepted
}
