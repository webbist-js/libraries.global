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
