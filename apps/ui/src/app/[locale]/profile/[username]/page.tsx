import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"
import { ProfileHero } from "./_components/ProfileHero"
import { ProfileTabNav } from "./_components/ProfileTabNav"
import { OverviewTab } from "./_components/tabs/OverviewTab"
import { ContributionsTab } from "./_components/tabs/ContributionsTab"
import { FollowingTab } from "./_components/tabs/FollowingTab"
import { CollectionsTab } from "./_components/tabs/CollectionsTab"
import { BadgesTab } from "./_components/tabs/BadgesTab"
import { ActivityTab } from "./_components/tabs/ActivityTab"

async function fetchProfile(username: string): Promise<UserProfile | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const res = await fetch(
    `${strapiUrl}/api/user-profiles/by-username/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) return null
  const json = (await res.json()) as { data: UserProfile }
  return json.data
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { username } = await params
  const { tab = "overview" } = await searchParams

  const [profile, session] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(await headers()),
  ])

  if (!profile) notFound()

  // TODO: resolve isOwnProfile — requires looking up the session user's baUserId
  // against profile.baUserId (not exposed publicly). For now always false.
  const isOwnProfile = false

  const TAB_CONTENT: Record<string, React.ReactNode> = {
    overview:      <OverviewTab profile={profile} />,
    contributions: <ContributionsTab />,
    following:     <FollowingTab />,
    collections:   <CollectionsTab />,
    badges:        <BadgesTab />,
    activity:      <ActivityTab />,
  }

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: "#050816" }}
    >
      <ProfileHero profile={profile} isOwnProfile={isOwnProfile} />
      <ProfileTabNav username={username} activeTab={tab} />
      <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
        {TAB_CONTENT[tab] ?? <OverviewTab profile={profile} />}
      </main>
    </div>
  )
}
