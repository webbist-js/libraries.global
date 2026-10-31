import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  getLocale,
  getTranslations as getUiTranslations,
} from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { contributionPlaceParams, placeAddHref } from "@/lib/contribution-place"
import { contributionPlacePrefill } from "@/lib/contribution-place-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import { isActiveTeam } from "@/lib/staff/team-status"
import type { TeamSummary } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Add a library")

export default async function AddLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string
    draft?: string
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
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    const base = placeAddHref(place, "/contribute/index/new", params.name)
    const callback = `${locale === "en" ? "" : `/${locale}`}${base}${params.draft === "contribute" ? `${base.includes("?") ? "&" : "?"}draft=contribute` : ""}`

    return <FeatureAccessLanding feature="add" returnTo={callback} />
  }
  const prefill = await contributionPlacePrefill(params, locale)
  const { name, draft } = params
  // Existing ordinary proposals keep their original review flow when the
  // contributor later becomes staff. New staff adds use the staff route.
  const ordinaryDraft = draft === "contribute"
  const hasStaffLibrary = staffLibrariesOf(session.user).length > 0
  const memberships = sessionTeamsOf(session.user)
  const teams =
    !ordinaryDraft && !hasStaffLibrary && memberships.length
      ? await fetchStaff<{ teams: TeamSummary[] }>(
          session.user,
          "teams/mine",
          "access"
        )
      : null
  const hasVerifiedTeam = teams?.body?.teams.some(
    (team) => team.verified && isActiveTeam(team)
  )
  if (
    !ordinaryDraft &&
    (hasStaffLibrary ||
      hasVerifiedTeam ||
      (memberships.length > 0 && !teams?.body))
  )
    redirect(placeAddHref(place, "/staff/new", name))

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        compact
        section={tUi("index_editor")}
        title="Add a library *to the index.*"
        lead="Fill in what you know. Your draft saves as you go, and an editor reviews it before it goes live."
      />
      <IndexRecordWizard
        mode="new"
        initialData={{
          ...prefill,
          ...(name?.trim() ? { name: name.trim().slice(0, 200) } : {}),
        }}
      />
    </div>
  )
}
