import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

import { ContributionsSection } from "../_components/sections/ContributionsSection"

export default async function ContributionsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const [{ username }, session] = await Promise.all([
    params,
    getSessionSSR(await headers()),
  ])
  // The layout made the same read, so React `cache` answers this one.
  const own = session?.user ? await fetchOwnProfile(session.user) : null

  return (
    <ContributionsSection
      username={username}
      isOwner={own?.username === username}
    />
  )
}
