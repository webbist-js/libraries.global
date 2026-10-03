import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

import { SettingsShell } from "./_components/SettingsShell"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, hdrs] = await Promise.all([params, headers()])

  const session = await getSessionSSR(hdrs)

  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/settings")

  // Owner view through the bridge: `baUserId` is private, so the public
  // REST filter on it can't find the profile.
  const profile = await fetchOwnProfile(session.user)

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <SettingsShell profile={profile} sessionUser={session.user} />
    </>
  )
}
