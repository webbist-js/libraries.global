import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import type { UserProfile } from "@/lib/types/profile"

import { ProfileHero } from "./_components/ProfileHero"
import { ProfilePrivatePage } from "./_components/ProfilePrivatePage"
import { ProfileTabNav } from "./_components/ProfileTabNav"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET

async function fetchProfile(
  username: string,
  opts?: { ownerBaUserId?: string; viewerBaUserId?: string }
): Promise<UserProfile | "private" | null> {
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
    if (res.status === 403) return "private"
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

async function fetchContributionCount(username: string): Promise<number> {
  if (!BRIDGE_SECRET) return 0
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/by-username/${encodeURIComponent(username)}`,
      { cache: "no-store", headers: { "X-Service-Secret": BRIDGE_SECRET } }
    )
    if (!res.ok) return 0
    const json = (await res.json()) as { data?: unknown[] }

    return json.data?.length ?? 0
  } catch {
    return 0
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>
}): Promise<Metadata> {
  const { locale, username } = await params
  // Anonymous fetch — what a crawler sees. Only "public" profiles are
  // indexable; private (403), limited and missing profiles are noindex.
  // Tab sub-pages inherit this, so their canonical is the overview URL.
  const profile = await fetchProfile(username)

  if (profile === null) {
    return { title: "Profile not found", robots: { index: false } }
  }
  if (profile === "private" || profile.profileVisibility !== "public") {
    return {
      title: `${username}'s profile`,
      robots: { index: false, follow: false },
    }
  }

  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ")
  const name = fullName || username

  return buildMetadata({
    title: fullName ? `${fullName} (@${username})` : `@${username}`,
    description:
      profile.bio ??
      `${name}'s library contributions, collections and activity on ${SITE_NAME}.`,
    path: `profile/${username}`,
    locale,
    type: "profile",
    image: formatStrapiMediaUrl(profile.avatar?.url),
    imageAlt: name,
  })
}

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; username: string }>
}) {
  const [{ locale, username }, hdrs] = await Promise.all([params, headers()])

  const [publicProfile, session, contributionCount] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(hdrs),
    fetchContributionCount(username),
  ])

  let profile: UserProfile | "private" | null = publicProfile
  let isOwnProfile = false

  if (session?.user?.id) {
    // Always determine ownership first — used for both private bypass and limited check
    const ownProfile = await fetchOwnProfile(session.user.id)
    isOwnProfile = ownProfile?.username === username

    if (profile === null || profile === "private") {
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
      if (expanded && expanded !== "private") profile = expanded
    } else if (profile.profileVisibility === "limited" && isOwnProfile) {
      // Owner viewing their own limited profile — get full data
      profile = await fetchProfile(username, {
        ownerBaUserId: session.user.id,
      })
    }
  }

  if (profile === null) notFound()

  // Private profile viewed by a non-owner — show dedicated page
  if (profile === "private") {
    return (
      <>
        <GlobalHeader locale={locale as Locale} />
        <ProfilePrivatePage username={username} />
      </>
    )
  }

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void }}
      >
        <ProfileHero
          profile={profile}
          isOwnProfile={isOwnProfile}
          isSignedIn={!!session?.user}
        />
        <ProfileTabNav
          username={username}
          counts={{
            contributions: contributionCount,
            libraries:
              (profile.followedLibraries?.length ?? 0) +
              (profile.claimedLibraries?.length ?? 0),
            recognition: profile.earnedBadges?.length ?? 0,
          }}
        />
        <main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </>
  )
}
