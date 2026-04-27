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
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`,
      { cache: "no-store" }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { id: number; attributes?: Record<string, unknown> }[]
    }
    const row = json.data?.[0]
    if (!row) return null

    return {
      id: row.id,
      ...(row.attributes as Omit<UserProfile, "id">),
    } as UserProfile
  } catch {
    return null
  }
}

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const [{ locale }, { section = "profile" }, hdrs] = await Promise.all([
    params,
    searchParams,
    headers(),
  ])

  const [session, navbarResult] = await Promise.all([
    getSessionSSR(hdrs),
    fetchNavbar(locale as Locale),
  ])

  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings")

  const profile = await fetchOwnProfile(session.user.id)

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <SettingsShell
        activeSection={section}
        profile={profile}
        sessionUser={session.user}
      />
    </>
  )
}
