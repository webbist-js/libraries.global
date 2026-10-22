import "server-only"
import { cache } from "react"

import type { UserProfile } from "@/lib/types/profile"

/** The service header passes the beta gate; only an explicit viewer grants a privacy bypass. */
const readProfile = cache(
  async (
    username: string,
    ownerBaUserId?: string,
    viewerBaUserId?: string
  ): Promise<UserProfile | "private" | null> => {
    const secret = process.env.STRAPI_BRIDGE_SECRET
    const params = new URLSearchParams()
    if (secret && ownerBaUserId) params.set("ownerBaUserId", ownerBaUserId)
    if (secret && viewerBaUserId) params.set("viewerBaUserId", viewerBaUserId)
    const query = params.size ? `?${params}` : ""
    try {
      const res = await fetch(
        `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/user-profiles/by-username/${encodeURIComponent(username)}${query}`,
        {
          cache: "no-store",
          headers: secret ? { "X-Service-Secret": secret } : {},
          signal: AbortSignal.timeout(5000),
        }
      )
      if (res.status === 403) return "private"
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Profile temporarily unavailable")
      const json = (await res.json()) as { data?: UserProfile }

      if (!json.data) throw new Error("Profile temporarily unavailable")

      return json.data
    } catch {
      throw new Error("Profile temporarily unavailable")
    }
  }
)

/** Layout, metadata and tabs share one request-local lookup for the same viewer. */
export function fetchPublicProfile(
  username: string,
  opts?: { ownerBaUserId?: string; viewerBaUserId?: string }
) {
  return readProfile(username, opts?.ownerBaUserId, opts?.viewerBaUserId)
}

/** Viewer identity and ownership must come from the server session and own-profile lookup. */
export async function profileForViewer(
  username: string,
  publicProfile: UserProfile | "private" | null,
  viewer?: { id: string; isOwner: boolean }
): Promise<UserProfile | null> {
  const profile = publicProfile === "private" ? null : publicProfile
  if (!viewer) return profile
  if (!profile && !viewer.isOwner) return null
  if (profile && profile.profileVisibility !== "limited") return profile
  const expanded = await fetchPublicProfile(username, {
    [viewer.isOwner ? "ownerBaUserId" : "viewerBaUserId"]: viewer.id,
  })

  return expanded && expanded !== "private" ? expanded : profile
}
