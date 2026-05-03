import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchNavbar } from "@/lib/strapi-api/content/server"
import type { UserProfile } from "@/lib/types/profile"

import { SettingsShell } from "./_components/SettingsShell"

async function fetchOwnProfile(baUserId: string): Promise<UserProfile | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
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

  const [session, navbarResult] = await Promise.all([
    getSessionSSR(hdrs),
    fetchNavbar(locale as Locale),
  ])

  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/settings")

  const profile = await fetchOwnProfile(session.user.id)

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <SettingsShell profile={profile} sessionUser={session.user} />
    </>
  )
}
