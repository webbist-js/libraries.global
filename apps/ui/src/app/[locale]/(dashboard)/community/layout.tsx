import { headers } from "next/headers"
import type { ReactNode } from "react"

import { CommunityWorkspace } from "@/components/community/CommunityWorkspace"
import { StandingCard } from "@/components/community/StandingCard"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import { fetchStanding } from "@/lib/community/leaderboard-server"
import { isVotable } from "@/lib/community/suggestions"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { openDriveCount } from "@/lib/drives/drive-view-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { getInitials } from "@/lib/types/leaderboard"

/** One persistent section navigation; the existing routes retain their own data/actions. */
export default async function CommunityLayout({
  children,
  params,
}: {
  readonly children: ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const { locale } = await params,
    session = await getSessionSSR(await headers()),
    user = session?.user
  const [standing, profile, drives, suggestions] = await Promise.all([
    user ? fetchStanding(user.id) : null,
    user ? fetchOwnProfile(user) : null,
    openDriveCount(locale),
    fetchPublicSuggestions(),
  ])

  return (
    <CommunityWorkspace
      counts={{
        noticeboard: drives,
        suggestions: suggestions.filter(isVotable).length,
      }}
      standing={
        <StandingCard
          compact
          standing={standing}
          signedIn={Boolean(user)}
          initials={
            profile
              ? getInitials(profile)
              : (user?.name?.slice(0, 2).toUpperCase() ?? "")
          }
          avatarUrl={avatarSrc(profile?.avatar)}
          background={profile?.profileBackground}
          signInReturnTo="/community"
        />
      }
    >
      {children}
    </CommunityWorkspace>
  )
}
