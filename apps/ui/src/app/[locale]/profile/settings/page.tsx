import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"

import { SettingsShell } from "./_components/SettingsShell"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

async function fetchOwnProfile(baUserId: string): Promise<UserProfile | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const bridgeSecret = process.env.STRAPI_BRIDGE_SECRET
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: UserProfile[] }
    const row = json.data?.[0]
    if (!row) return null

    // The settings page needs relations (avatar, interests, claimed and
    // followed libraries) — the owner-scoped by-username endpoint returns
    // the fully populated profile.
    if (row.username && bridgeSecret) {
      try {
        const fullRes = await fetch(
          `${strapiUrl}/api/user-profiles/by-username/${encodeURIComponent(row.username)}?ownerBaUserId=${encodeURIComponent(baUserId)}`,
          { cache: "no-store", headers: { "X-Service-Secret": bridgeSecret } }
        )
        if (fullRes.ok) {
          const fullJson = (await fullRes.json()) as { data?: UserProfile }
          if (fullJson.data) return fullJson.data
        }
      } catch {
        // fall through to the plain row
      }
    }

    return row
  } catch {
    return null
  }
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, hdrs] = await Promise.all([params, headers()])

  const session = await getSessionSSR(hdrs)

  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/settings")

  const profile = await fetchOwnProfile(session.user.id)

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <SettingsShell profile={profile} sessionUser={session.user} />
    </>
  )
}
