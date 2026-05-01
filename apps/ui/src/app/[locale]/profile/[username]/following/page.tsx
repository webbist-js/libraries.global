import { notFound } from "next/navigation"

import type { UserProfile } from "@/lib/types/profile"

import { FollowingTab } from "../_components/tabs/FollowingTab"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function fetchProfile(username: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}`,
      { next: { revalidate: 60 } }
    )
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
  const profile = await fetchProfile(username)
  if (!profile) notFound()

  return <FollowingTab followedLibraries={profile.followedLibraries ?? []} />
}
