import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { AccountGuard } from "@/components/auth/AccountGuard"
import {
  KNOWLEDGE_SLUGS,
  knowledgeHref,
} from "@/components/staff/knowledge-links"
import { StaffWorkspace } from "@/components/staff/StaffWorkspace"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"
import { STAFF_DISCOVERY_PATHS } from "@/lib/feature-access"
import { fetchStaffTeams } from "@/lib/staff/teams-server"
import { canAddStaffLibrary } from "@/lib/staff/workspace-access"

export const metadata: Metadata = {
  title: "Staff area",
  robots: { index: false, follow: false },
}

export default async function StaffSectionLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const [{ locale }, session] = await Promise.all([
    params,
    getContributionSession(),
  ])
  const libraries = staffLibrariesOf(session?.user),
    teams = sessionTeamsOf(session?.user)
  const [guideHref, teamsResult] = await Promise.all([
    knowledgeHref(KNOWLEDGE_SLUGS.staffArea, locale as Locale),
    session?.user && teams.length ? fetchStaffTeams(session.user) : null,
  ])

  return (
    <AccountGuard
      expectedScope={contributionAccountScope(session?.user)}
      publicGuestPaths={STAFF_DISCOVERY_PATHS}
    >
      <StaffWorkspace
        libraries={libraries}
        userId={session?.user?.id}
        teamId={teams[0]?.id}
        adding={canAddStaffLibrary(
          libraries.length,
          teamsResult?.status === 200 ? (teamsResult.body?.teams ?? []) : []
        )}
        guideHref={guideHref ?? "/knowledge"}
      >
        {children}
      </StaffWorkspace>
    </AccountGuard>
  )
}
