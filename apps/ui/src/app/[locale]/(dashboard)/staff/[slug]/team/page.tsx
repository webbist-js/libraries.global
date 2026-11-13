import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { FeatureGatePanel, Notice } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { withMessages } from "@/i18n/scoped-messages"
import { canStaffTool, sessionTeamsOf } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
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
            className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
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
 * The library's Team tab. Uncovered (no staff workspace of the viewer's
 * covers this library): how a free workspace helps, who has staff access,
 * Leave and Report.
 * Covered: the staff list with levels and live permission, invites to the
 * Team pre-assigned here (organisers), pending invites and recent changes.
 * A Team that covers the library without the viewer in it: a line naming
 * its organiser instead of the gate.
 */
async function TeamPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
}) {
  const tStatic = await getTranslations("staticUi")

  const tExisting = await getTranslations()

  const tUi = await getTranslations("ui")

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
  const full = result.body.covered && canStaffTool(user, "seeTeam", documentId)
  // A Team covers the library but the viewer isn't in it (`coveringTeam`,
  // absent from older responses): name its organiser instead of the gate.
  const covering = result.body.coveringTeam ?? null
  const outsideTeam = !full && !!covering && !covering.viewerIsMember
  const hasWorkspace = sessionTeamsOf(user).length > 0

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
            to add you to the workspace. The organiser can assign you to its
            libraries at Owner or Editor level; each assignment is checked
            before you can edit.
          </p>
          <LearnMoreLink
            slug={KNOWLEDGE_SLUGS.teams}
            locale={locale as Locale}
          />
        </Notice>
      ) : !full ? (
        <>
          <FeatureGatePanel
            badge="Free staff workspace"
            title={tUi("manage_your_librarys_staff")}
            lead={tStatic(
              "staffRoute.set_up_a_free_staff_workspace_to_invite_colleagues_give_them_roles_and_choose_who_can_edit_or_go_liv"
            )}
            points={[
              "Invite colleagues by email",
              "Owner and Editor levels per library",
              "Choose who can go live on mobile libraries",
            ]}
            note="Workspaces are free. Adding a library to one still needs your verified owner access, and each colleague’s assignment is checked."
            action={
              hasWorkspace
                ? {
                    href: "/staff/teams",
                    label: tStatic("staffRoute.open_your_workspace"),
                  }
                : {
                    href: "/staff/teams/new",
                    label: tExisting("featureAccess.setUpTeam"),
                  }
            }
            preview={<TeamPreview />}
            previewCaption="Illustration of a staff list"
          />
          <LearnMoreLink
            slug={KNOWLEDGE_SLUGS.teams}
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

export default withMessages(
  TeamPage,
  "[locale]/(dashboard)/staff/[slug]/team/page"
)
