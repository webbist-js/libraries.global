import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import type { UserProfile } from "@/lib/types/profile"

import { FollowingSection } from "../_components/sections/FollowingSection"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET

async function fetchProfile(
  username: string,
  opts?: { ownerBaUserId?: string; viewerBaUserId?: string }
): Promise<UserProfile | null> {
  try {
    let url = `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}`
    const reqHeaders: Record<string, string> = {}
    if (BRIDGE_SECRET && (opts?.ownerBaUserId ?? opts?.viewerBaUserId)) {
      const params = new URLSearchParams()
      if (opts?.ownerBaUserId) params.set("ownerBaUserId", opts.ownerBaUserId)
      if (opts?.viewerBaUserId)
        params.set("viewerBaUserId", opts.viewerBaUserId)
      url += `?${params.toString()}`
      reqHeaders["X-Service-Secret"] = BRIDGE_SECRET
    }
    const res = await fetch(url, { cache: "no-store", headers: reqHeaders })
    if (!res.ok) return null
    const json = (await res.json()) as { data: UserProfile }

    return json.data
  } catch {
    return null
  }
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const [publicProfile, session] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(await headers()),
  ])

  let profile: UserProfile | null = publicProfile

  if (session?.user?.id) {
    const ownProfile = await fetchOwnProfile(session.user)
    const isOwnProfile = ownProfile?.username === username

    if (!profile) {
      if (isOwnProfile) {
        profile = await fetchProfile(username, {
          ownerBaUserId: session.user.id,
        })
      }
    } else if (profile.profileVisibility === "limited") {
      const expanded = await fetchProfile(username, {
        [isOwnProfile ? "ownerBaUserId" : "viewerBaUserId"]: session.user.id,
      })
      if (expanded) profile = expanded
    }
  }

  if (!profile) notFound()

  return (
    <FollowingSection
      username={username}
      followedLibraries={profile.followedLibraries ?? []}
      followedUsers={profile.followedProfiles ?? []}
      claimedLibraries={profile.claimedLibraries ?? []}
    />
  )
}
