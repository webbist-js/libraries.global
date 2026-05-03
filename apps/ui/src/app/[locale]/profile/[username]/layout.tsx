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

  const [publicProfile, session, navbarResult] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(hdrs),
    fetchNavbar(locale as Locale),
  ])

  let profile: UserProfile | null = publicProfile
  let isOwnProfile = false

  if (session?.user?.id) {
    // Always determine ownership first — used for both private bypass and limited check
    const ownProfile = await fetchOwnProfile(session.user.id)
    isOwnProfile = ownProfile?.username === username

    if (!profile) {
      // Private profile — owner can always view their own page
      if (isOwnProfile) {
        profile = await fetchProfile(username, {
          ownerBaUserId: session.user.id,
        })
      }
    } else if (profile.profileVisibility === "limited" && !isOwnProfile) {
      // Limited profile — re-fetch with viewer identity so Strapi can check
      // whether this user is affiliated with any of the same libraries
      const expanded = await fetchProfile(username, {
        viewerBaUserId: session.user.id,
      })
      if (expanded) profile = expanded
    } else if (profile.profileVisibility === "limited" && isOwnProfile) {
      // Owner viewing their own limited profile — get full data
      profile = await fetchProfile(username, {
        ownerBaUserId: session.user.id,
      })
    }
  }

  if (!profile) notFound()

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.space }}
      >
        <ProfileHero
          profile={profile}
          isOwnProfile={isOwnProfile}
          isSignedIn={!!session?.user}
        />
        <ProfileTabNav
          username={username}
          profileVisibility={profile.profileVisibility}
        />
        <main className="mx-auto w-full max-w-[1296px] px-6 py-8 md:px-10">
          {children}
        </main>
      </div>
    </>
  )
}
