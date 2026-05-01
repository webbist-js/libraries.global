import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"
import type { UserProfile } from "@/lib/types/profile"

import { ProfileHero } from "./_components/ProfileHero"
import { ProfileTabNav } from "./_components/ProfileTabNav"

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

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; username: string }>
}) {
  const [{ locale, username }, hdrs] = await Promise.all([params, headers()])

  const [profile, session, navbarResult] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(hdrs),
    fetchNavbar(locale as Locale),
  ])

  if (!profile) notFound()

  let isOwnProfile = false
  if (session?.user) {
    const ownProfile = await fetchOwnProfile(session.user.id)
    isOwnProfile = ownProfile?.username === username
  }

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.space }}
      >
        <ProfileHero profile={profile} isOwnProfile={isOwnProfile} />
        <ProfileTabNav username={username} />
        <main className="mx-auto w-full max-w-[1296px] px-6 py-8 md:px-10">
          {children}
        </main>
      </div>
    </>
  )
}
