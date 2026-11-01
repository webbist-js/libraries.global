import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  getLocale,
  getTranslations as getUiTranslations,
} from "next-intl/server"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Notice } from "@/components/ds/Notice"
import { Container } from "@/components/elementary/Container"
import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import { StaffAccessRequired } from "@/components/staff/StaffAccessRequired"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import {
  contributionPlaceParams,
  placeAddHref,
  withLibraryDraft,
} from "@/lib/contribution-place"
import { contributionPlacePrefill } from "@/lib/contribution-place-server"
import { loadNewLibraryDraft } from "@/lib/new-library-draft-server"
import { privateMetadata } from "@/lib/seo/metadata"
import { isActiveTeam } from "@/lib/staff/team-status"
import type { TeamSummary } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

export const metadata = privateMetadata("Add a library as staff")

export default async function StaffNewLibraryPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    resume?: string
    name?: string
    continent?: string
    country?: string
    region?: string
    area?: string
  }>
}) {
  const tUi = await getUiTranslations("ui")

  const params = await searchParams
  const locale = await getLocale()
  const place = contributionPlaceParams(params)
  const prefill = await contributionPlacePrefill(params, locale)
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    const base = placeAddHref(place, "/staff/new", params.name)
    const callback = withLibraryDraft(
      `${locale === "en" ? "" : `/${locale}`}${base}`,
      params
    )
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`)
  }
  const resumeSubmission = await loadNewLibraryDraft(
    params.resume,
    session.user,
    true
  )
  const libraries = staffLibrariesOf(session.user)
  const memberships = sessionTeamsOf(session.user)
  if (!libraries.length && !memberships.length)
    return <StaffAccessRequired signedIn />
  const teamResult = memberships.length
    ? await fetchStaff<{ teams: TeamSummary[] }>(
        session.user,
        "teams/mine",
        "access"
      )
    : null
  const teams = (teamResult?.body?.teams ?? []).filter((team) =>
    isActiveTeam(team)
  )
  if (memberships.length > 0 && !teamResult?.body)
    return (
      <>
        <WorkspacePageHeader
          density="task"
          title="Add a library"
          tabs={
            <StaffAreaTabs active="new" adding teamId={memberships[0]?.id} />
          }
        />
        <Container className="py-10">
          <Notice
            icon="mdi:alert-outline"
            tone="warn"
            title={tUi("team_coverage_couldnt_be_loaded")}
          >
            Reload this page to choose the Team for your new library.
          </Notice>
        </Container>
      </>
    )
  if (!libraries.length && !teams.some((team) => team.verified))
    return <StaffAccessRequired signedIn />
  const { name } = params

  return (
    <>
      <WorkspacePageHeader
        density="task"
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: tUi("add_a_library") },
        ]}
        title="Add a library"
        tabs={<StaffAreaTabs active="new" adding teamId={memberships[0]?.id} />}
        lead="Fill in what you know. An editor reviews the new library and your staff access before it goes live."
      />
      <Container className="py-10">
        <IndexRecordWizard
          mode="staff-new"
          resumeSubmission={resumeSubmission ?? undefined}
          creationTeams={teams.map((team) => ({
            id: team.id,
            name: team.name,
          }))}
          initialData={{
            ...prefill,
            ...(name?.trim() ? { name: name.trim().slice(0, 200) } : {}),
          }}
        />
      </Container>
    </>
  )
}
