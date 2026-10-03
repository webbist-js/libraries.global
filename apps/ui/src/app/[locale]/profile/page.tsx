import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  robots: "noindex, nofollow",
}

import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

export default async function OwnProfilePage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin")

  // Own profile through the bridge (`baUserId` is private). redirect()
  // throws, so it stays outside any try/catch.
  const profile = await fetchOwnProfile(session.user)
  if (profile?.username) redirect(`/profile/${profile.username}`)

  // Fallback: redirect to settings to complete profile
  redirect("/profile/settings")
}
