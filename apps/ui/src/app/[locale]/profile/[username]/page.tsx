import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"

import { OverviewSection } from "./_components/sections/OverviewSection"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

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

async function fetchOwnProfile(baUserId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`,
      {
        cache: "no-store",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: UserProfile[] }

    return json.data?.[0] ?? null
  } catch {
    return null
  }
}

export default async function ProfileOverviewPage({
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
  let isOwner = false

  if (session?.user?.id) {
    const ownProfile = await fetchOwnProfile(session.user.id)
    isOwner = ownProfile?.username === username

    if (!profile) {
      if (isOwner) {
        profile = await fetchProfile(username, {
          ownerBaUserId: session.user.id,
        })
      }
    } else if (profile.profileVisibility === "limited") {
      const expanded = await fetchProfile(username, {
        [isOwner ? "ownerBaUserId" : "viewerBaUserId"]: session.user.id,
      })
      if (expanded) profile = expanded
    }
  }

  if (!profile) notFound()

  return <OverviewSection profile={profile} isOwner={isOwner} />
}
