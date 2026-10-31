import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
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
import { TeamOrganiser } from "@/components/staff/TeamOrganiser"
import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { teamWorkspaceHref } from "@/lib/staff/paths"
import type { TeamDetail } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

function teamLead(
  team: TeamDetail | null | undefined,
  name: string,
  organiser: boolean
) {
  if (!organiser)
    return `${team?.name ?? name} provides Pro while active. Library staff access requires verification. Ask ${team?.organiserNames.join(" or ") || "your organiser"} to change your access.`

  return team?.verifiedAt
    ? "Invite colleagues, assign them to your Libraries and manage their access. Add seats from Billing & seats when your Team grows."
    : "Invite colleagues, connect your service and manage your Team’s libraries. Library access is reviewed separately."
}

/**
 * The Team organiser: the Team's seats, libraries and members, with
 * invites, team roles, per-library assignments and removal for organisers.
 * Members see it read only. The account has one Team; no selection is carried in the URL.
 */
export default async function TeamOrganiserPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>
  readonly searchParams: Promise<{ team?: string }>
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
  if ((await searchParams).team) redirect(teamWorkspaceHref("", locale))
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
        context={team?.name ?? chosen.name}
        tabs={<StaffAreaTabs active="team" teamId={chosen.id} />}
        lead={teamLead(team, chosen.name, organiser)}
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
