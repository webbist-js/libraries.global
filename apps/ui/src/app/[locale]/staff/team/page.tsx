import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamOrganiser } from "@/components/staff/TeamOrganiser"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import type { TeamDetail } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

/**
 * The Team organiser: the Team's seats, libraries and members, with
 * invites, team roles, per-library assignments and removal for organisers.
 * Members see it read only. `?team=` picks one of several Teams.
 */
export default async function TeamOrganiserPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>
  readonly searchParams: Promise<{ team?: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, session] = await Promise.all([
    params,
    getSessionSSR(await headers()),
  ])
  if (!session?.user) redirect("/auth/signin?callbackUrl=%2Fstaff%2Fteam")
  const teams = sessionTeamsOf(session.user)
  if (teams.length === 0) notFound()
  const { team: wanted } = await searchParams
  const ordered = [...teams].sort((a, b) =>
    a.role === b.role ? 0 : a.role === "organiser" ? -1 : 1
  )
  const chosen =
    (wanted && isDocumentIdParam(wanted)
      ? ordered.find((t) => t.id === wanted)
      : null) ?? ordered[0]!
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
      <PageHero
        compact
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: team?.name ?? chosen.name },
        ]}
        eyebrow={organiser ? "Team organiser" : "Your team"}
        eyebrowIcon="mdi:account-group-outline"
        plainTitle={organiser}
        title={organiser ? (team?.name ?? chosen.name) : `Your *team*`}
        lead={
          organiser
            ? "Invite colleagues, give them staff access on your libraries and choose their level. Changes take effect at once."
            : `${team?.name ?? chosen.name} gives you Pro and staff access on its libraries. Ask ${team?.organiserNames.join(" or ") || "your organiser"} to change your access.`
        }
      >
        <LearnMoreLink slug={KNOWLEDGE_SLUGS.teams} locale={locale as Locale} />
      </PageHero>
      <Container className="py-10">
        {result.status !== 200 || !team ? (
          <StaffLoadError what="The team" status={result.status} />
        ) : (
          <TeamOrganiser
            team={team}
            others={ordered
              .filter((t) => t.id !== team.documentId)
              .map((t) => ({ id: t.id, name: t.name }))}
          />
        )}
      </Container>
    </>
  )
}
