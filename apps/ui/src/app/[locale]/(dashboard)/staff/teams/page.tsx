import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamMembershipConflict } from "@/components/staff/TeamMembershipConflict"
import { TeamNameContext } from "@/components/staff/TeamNameContext"
import { TeamOrganiser } from "@/components/staff/TeamOrganiser"
import { withMessages } from "@/i18n/scoped-messages"
import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import type { TeamDetail } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

function teamLead(team: TeamDetail | null | undefined, organiser: boolean) {
  if (!organiser)
    return `Your library access comes from your own verified staff claims, not from this workspace. Ask ${team?.organiserNames.join(" or ") || "your organiser"} to change your assignments.`

  return team?.verifiedAt
    ? "Invite colleagues, assign them to your libraries and manage their access. The workspace is free and has no member limit."
    : "Invite colleagues, connect your service and choose the libraries you look after. Each library assignment is reviewed separately."
}

/**
 * The free staff workspace: its libraries and members, with invites, team
 * roles, per-library assignments and removal for organisers. Members see it
 * read only. Membership never grants library editing; that comes only from
 * each person's verified staff claims. The account has one workspace.
 */
async function TeamOrganiserPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")
  const t = await getUiTranslations("staffWorkspace")

  const [{ locale }, session] = await Promise.all([
    params,
    getSessionSSR(await headers()),
  ])
  if (!session?.user) return <FeatureAccessLanding feature="teams" />
  const teams = preferredTeams(sessionTeamsOf(session.user))
  if (teams.length === 0)
    return <FeatureAccessLanding feature="teams" signedIn />
  if (teams.length > 1) return <TeamMembershipConflict />
  const chosen = teams[0]!
  const result = await fetchStaff<TeamDetail>(
    session.user,
    `teams/${chosen.id}`,
    "access"
  )
  if (result.status === 404 || result.status === 403) notFound()
  const team = result.body
  const organiser = team?.viewerRole === "organiser"

  return (
    <>
      <WorkspacePageHeader
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: t("membersLibraries") },
        ]}
        title={t("membersLibraries")}
        context={<TeamNameContext name={team?.name ?? chosen.name} />}
        tabs={<StaffAreaTabs active="team" teamId={chosen.id} />}
        lead={teamLead(team, organiser)}
        actions={
          <LearnMoreLink
            slug={KNOWLEDGE_SLUGS.teams}
            locale={locale as Locale}
          />
        }
      />
      <Container className="py-10">
        {result.status !== 200 || !team ? (
          <StaffLoadError what="The team" status={result.status} />
        ) : (
          <TeamOrganiser team={team} />
        )}
      </Container>
    </>
  )
}

export default withMessages(
  TeamOrganiserPage,
  "[locale]/(dashboard)/staff/teams/page"
)
