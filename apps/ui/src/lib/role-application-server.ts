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
  if (!process.env.STRAPI_BRIDGE_SECRET) return []
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: bridgeUserHeaders(user),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: unknown }

    return Array.isArray(json.data) ? (json.data as MySubmissionRow[]) : []
  } catch {
    return []
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
  if (!process.env.STRAPI_BRIDGE_SECRET) return 0
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/my/accepted-count`,
      { cache: "no-store", headers: bridgeUserHeaders(user) }
    )
    if (!res.ok) return 0
    const json = (await res.json()) as { data?: { accepted?: unknown } }
    const accepted = json.data?.accepted

    return typeof accepted === "number" && Number.isFinite(accepted)
      ? Math.max(0, Math.floor(accepted))
      : 0
  } catch {
    return 0
  }
}
