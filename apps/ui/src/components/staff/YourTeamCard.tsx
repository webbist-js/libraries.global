"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "@/components/ds"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { useStaff } from "@/lib/access-client"
import { preferredTeams } from "@/lib/access-server"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamSummary } from "@/lib/staff/types"

/** Team summary and destinations; API status is only shown by its own dashboard. */
export function YourTeamCard({ teams }: { readonly teams?: TeamSummary[] }) {
  const t = useTranslations("staffWorkspace")
  const { teams: sessionTeams, libraries, ready } = useStaff()
  const [now] = useState(() => Date.now())
  const rows: TeamSummary[] = preferredTeams(
    teams ??
      sessionTeams.map((team) => ({
        ...team,
        status: team.status ?? "lapsed",
        expiresAt: team.expiresAt ?? null,
        verified: false,
        organiserName: null,
        libraryDocumentIds: [],
      }))
  )
  if ((!teams && !ready) || rows.length === 0) return null
  if (rows.length > 1)
    return (
      <StaffPanel title="Your Team" compact>
        <p className="text-base leading-relaxed text-(--t-ink-dim)">
          Your account has older memberships to reconcile before opening its
          Team workspace.
        </p>
        <Link
          href="/staff/teams"
          className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline underline-offset-4"
        >
          Check Team membership
        </Link>
      </StaffPanel>
    )

  return (
    <StaffPanel id="your-team" title={t("teamLinks")} compact>
      <ul className="m-0 list-none space-y-6 p-0">
        {rows.map((team) => {
          const covered = libraries.filter((lib) =>
            team.libraryDocumentIds.includes(lib.id)
          )
          const active =
            team.status === "active" &&
            (!team.expiresAt || Date.parse(team.expiresAt) > now)

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
                    : "Member"}
                {" · "}
                {team.libraryCount}{" "}
                {team.libraryCount === 1 ? "library" : "libraries"}
                {!active ? " · not active" : ""}
              </p>
              <div className="divide-y divide-(--t-border-line) border-y border-(--t-border-line)">
                <Link
                  href="/staff/teams"
                  className="flex min-h-14 flex-wrap items-center gap-2 py-3 text-base font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                >
                  <span className="min-w-0 flex-1">
                    {t("membersLibraries")}
                  </span>
                  {teams ? (
                    <Badge
                      label={team.verified ? t("verified") : t("notVerified")}
                      color={team.verified ? "ok" : "warn"}
                    />
                  ) : null}
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
                </Link>
                <Link
                  href="/staff/teams/api"
                  className="flex min-h-14 items-center justify-between gap-2 py-3 text-base font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                >
                  {t("apiAccess")}
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
                </Link>
                <Link
                  href="/staff/teams/billing"
                  className="flex min-h-14 items-center justify-between gap-2 py-3 text-base font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                >
                  {t("billing")}
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
