import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { Notice, PlanGatePanel } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
import { TEAM_CONTACT_HREF } from "@/lib/plans"
import { loadStaffPage } from "@/lib/staff/server"
import type { StaffTeam } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

import { TeamManager } from "../_components/TeamManager"

/** The gate's "Preview with sample data": three staff rows, drawn. */
function TeamPreview() {
  const rows = [
    { name: "w-32", role: "Owner" },
    { name: "w-40", role: "Editor" },
    { name: "w-28", role: "Editor" },
  ]

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((row) => (
        <li
          key={row.role + row.name}
          className="flex items-center gap-3 rounded-[16px] border px-4 py-3"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <span
            className="size-10 shrink-0 rounded-full"
            style={{
              background: T.accent.chip,
            }}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className="block h-2.5 w-full rounded-full"
              style={{ background: T.bg.muted2 }}
            />
          </span>
          <span
            className="rounded-full border px-2.5 py-0.5 text-[12px] font-semibold"
            style={{
              background: T.bg.deep,
              color: T.ink.dim,
            }}
          >
            {row.role}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The library's Team tab. Uncovered (no active Team of the viewer's covers
 * this library): the plan gate, who has staff access, Leave and Report.
 * Covered: the staff list with levels and live permission, invites to the
 * Team pre-assigned here (organisers), pending invites and recent changes.
 * A Team that covers the library without the viewer in it: a line naming
 * its organiser instead of the gate.
 */
export default async function TeamPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale, slug } = await params
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const result = await fetchStaff<StaffTeam>(
    user,
    `libraries/${documentId}/team`
  )
  if (result.status !== 200 || !result.body)
    return <StaffLoadError what="The staff list" status={result.status} />
  // The session's pre-check and Strapi's answer must both agree.
  const full =
    result.body.covered &&
    requireEntitlementForLibrary(user, "library.team", documentId) === null
  // A Team covers the library but the viewer isn't in it (`coveringTeam`,
  // absent from older responses): name its organiser instead of the gate.
  const covering = result.body.coveringTeam ?? null
  const outsideTeam = !full && !!covering && !covering.viewerIsMember

  return (
    <div className="max-w-[1180px] space-y-6">
      {outsideTeam ? (
        <Notice
          icon="mdi:account-group-outline"
          tone="info"
          title={`${covering.name} covers this library`}
        >
          <p className="m-0" style={{ color: T.ink.base }}>
            Ask {covering.organiserName ?? "its organiser"}
            {covering.organiserEmailMasked
              ? ` (${covering.organiserEmailMasked})`
              : ""}{" "}
            to add you to the team. Members get Pro and staff access on its
            libraries, and the organiser sets Owner and Editor levels.
          </p>
          <LearnMoreLink
            slug={KNOWLEDGE_SLUGS.teams}
            locale={locale as Locale}
          />
        </Notice>
      ) : !full ? (
        <>
          <PlanGatePanel
            title={tUi("manage_your_librarys_staff")}
            lead="Invite colleagues, give them roles, and choose who can edit or go live. Your Team organiser manages access. Without Team, each staff member claims access on their own."
            points={[
              "Invite colleagues through your Team organiser",
              "Owner and Editor levels per library",
              "Choose who can go live on mobile libraries",
            ]}
            compareHref="/contribute/membership"
            contactHref={TEAM_CONTACT_HREF}
            preview={<TeamPreview />}
          />
          <LearnMoreLink
            slug={KNOWLEDGE_SLUGS.plans}
            locale={locale as Locale}
          />
        </>
      ) : null}
      <TeamManager
        id={documentId}
        libraryName={overview.library.name}
        data={result.body}
        role={overview.role}
        full={full}
        mobile={overview.library.libraryType === "Mobile"}
      />
      {full ? (
        <LearnMoreLink slug={KNOWLEDGE_SLUGS.teams} locale={locale as Locale} />
      ) : null}
    </div>
  )
}
