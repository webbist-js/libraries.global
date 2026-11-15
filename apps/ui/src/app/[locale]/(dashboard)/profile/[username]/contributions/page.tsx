import { headers } from "next/headers"

import { ContributionsSection } from "@/app/[locale]/profile/[username]/_components/sections/ContributionsSection"
import { withMessages } from "@/i18n/scoped-messages"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

async function ContributionsPage({
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

export default withMessages(
  ContributionsPage,
  "[locale]/(dashboard)/profile/[username]/contributions/page"
)
