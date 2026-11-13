"use client"
import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import { useStaff } from "@/lib/access-client"
import { preferredTeams } from "@/lib/access-server"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import { isActiveTeam } from "@/lib/staff/team-status"
import type { TeamSummary } from "@/lib/staff/types"

/**
 * The free staff workspace summary and destinations. API access lives on
 * /developers and is bought separately; neither grants library editing.
 */
export function YourTeamCard({ teams }: { readonly teams?: TeamSummary[] }) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const t = useTranslations("staffWorkspace")
  const { teams: sessionTeams, libraries, ready } = useStaff()
  const rows: TeamSummary[] = preferredTeams(
    teams ??
      sessionTeams.map((team) => ({
        ...team,
        verified: false,
        organiserName: null,
        libraryDocumentIds: [],
      }))
  )
  if ((!teams && !ready) || rows.length === 0) return null
  if (rows.length > 1)
    return (
      <StaffPanel title={tExisting("staffWorkspace.teamLinks")} compact>
        <p className="text-base leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "staff.your_account_has_older_memberships_to_reconcile_before_opening_its_team_workspace"
          )}
        </p>
        <Link
          href="/staff/teams"
          className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline underline-offset-4"
        >
          {tStatic("staff.check_team_membership")}
        </Link>
      </StaffPanel>
    )

  return (
    <StaffPanel id="your-team" title={t("teamLinks")} compact>
      {teams === undefined ? (
        <p className="mb-4 text-sm text-(--t-ink-dim)" role="status">
          {t("detailsUnavailable")}
        </p>
      ) : null}
      <ul className="m-0 list-none space-y-6 p-0">
        {rows.map((team) => {
          const covered = libraries.filter((lib) =>
            team.libraryDocumentIds.includes(lib.id)
          )
          // Workspaces are free: only a workspace the server reports closed shows so.
          const statusKnown = teams !== undefined
          const active = isActiveTeam(team)

          return (
            <li key={team.id} className="min-w-0">
              <h3 className="type-card-title m-0 [overflow-wrap:anywhere] text-(--t-ink-base)">
                {team.name}
              </h3>
              <p className="mt-2 mb-4 text-base leading-relaxed text-(--t-ink-dim)">
                {team.role === "organiser"
                  ? "You organise it"
                  : team.organiserName
                    ? "Organised by " + team.organiserName
                    : tExisting("teamInvitation.member")}
                {" · "}
                {t("coverageCount", { count: team.libraryCount })}
              </p>
              <div className="mb-4">
                <TeamStatusBadges
                  workspace={
                    statusKnown ? (active ? "open" : "closed") : undefined
                  }
                  verified={teams !== undefined ? team.verified : undefined}
                />
              </div>
              <div className="divide-y divide-(--t-border-line) border-y border-(--t-border-line)">
                <Link
                  href="/staff/teams"
                  className="flex min-h-14 flex-wrap items-center gap-2 py-3 text-base font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                >
                  <span className="min-w-0 flex-1">
                    {t("membersLibraries")}
                  </span>
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
                </Link>
                <Link
                  href="/developers"
                  className="flex min-h-14 items-center justify-between gap-2 py-3 text-base font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                >
                  {t("apiAccess")}
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
                </Link>
              </div>
              {covered.length > 0 ? (
                <ul className="mt-4 mb-0 list-none space-y-1 p-0">
                  {covered.map((lib) => (
                    <li key={lib.id}>
                      <Link
                        href={staffLibraryHref(lib.slug)}
                        className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-(--t-accent-primary) underline underline-offset-4"
                      >
                        <Icon
                          aria-hidden="true"
                          icon="mdi:library-outline"
                          width={16}
                        />
                        {lib.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </StaffPanel>
  )
}
