import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchNavbar } from "@/lib/strapi-api/content/server"
import type { UserProfile } from "@/lib/types/profile"

import { ProfileHero } from "./_components/ProfileHero"
import { ProfileTabNav } from "./_components/ProfileTabNav"
import { ActivityTab } from "./_components/tabs/ActivityTab"
import { BadgesTab } from "./_components/tabs/BadgesTab"
import { CollectionsTab } from "./_components/tabs/CollectionsTab"
import { ContributionsTab } from "./_components/tabs/ContributionsTab"
import { FollowingTab } from "./_components/tabs/FollowingTab"
import { OverviewTab } from "./_components/tabs/OverviewTab"

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

async function fetchOwnProfile(baUserId: string): Promise<UserProfile | null> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: UserProfile[] }

    return json.data?.[0] ?? null
  } catch {
    return null
  }
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ locale, username }, { tab = "overview" }, hdrs] = await Promise.all([
    params,
    searchParams,
    headers(),
  ])

  const [profile, session, navbarResult] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(hdrs),
    fetchNavbar(locale as Locale),
  ])

  if (!profile) notFound()

  // Determine if the viewer is looking at their own profile
  let isOwnProfile = false
  if (session?.user) {
    const ownProfile = await fetchOwnProfile(session.user.id)
    isOwnProfile = ownProfile?.username === username
  }

  const TAB_CONTENT: Record<string, React.ReactNode> = {
    overview: <OverviewTab profile={profile} />,
    contributions: <ContributionsTab />,
    following: (
      <FollowingTab followedLibraries={profile.followedLibraries ?? []} />
    ),
    collections: <CollectionsTab />,
    badges: <BadgesTab />,
    activity: <ActivityTab />,
  }

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: "#050816" }}
      >
        <ProfileHero profile={profile} isOwnProfile={isOwnProfile} />
        <ProfileTabNav username={username} activeTab={tab} />
        <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
          {TAB_CONTENT[tab] ?? TAB_CONTENT.overview}
        </main>
      </div>
    </>
  )
}
