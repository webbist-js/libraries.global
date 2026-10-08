"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { useStaff } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamSummary } from "@/lib/staff/types"

/**
 * "Your team" on the staff index: each Team the viewer belongs to, its
 * organiser, and which of the viewer's libraries it covers. Organisers get
 * a link to the Team organiser; members see the read-only team page.
 * `teams` comes from the page (`GET /api/staff/team`); without it the
 * session's summaries are shown.
 */
export function YourTeamCard({ teams }: { readonly teams?: TeamSummary[] }) {
  const { teams: sessionTeams, libraries, ready } = useStaff()
  // Read once per mount: the clock has no place in render.
  const [now] = useState(() => Date.now())
  const rows: TeamSummary[] =
    teams ??
    sessionTeams.map((t) => ({
      ...t,
      status: "active",
      expiresAt: null,
      verified: false,
      organiserName: null,
      libraryDocumentIds: [],
    }))
  if (!teams && !ready) return null
  if (rows.length === 0) return null

  return (
    <section
      aria-labelledby="your-team-h"
      className="mt-8 rounded-[20px] border p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <h2
        id="your-team-h"
        className="m-0 mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: T.ink.dim }}
      >
        <Icon
          aria-hidden="true"
          height={15}
          icon="mdi:account-group-outline"
          style={{ color: T.accent.primary }}
          width={15}
        />
        Your team
      </h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {rows.map((team) => {
          const covered = libraries.filter((lib) =>
            team.libraryDocumentIds.includes(lib.id)
          )
          const active =
            team.status === "active" &&
            (!team.expiresAt || Date.parse(team.expiresAt) > now)

          return (
            <li
              key={team.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h3
                  className="m-0 text-[20px]"
                  style={{ fontFamily: T.font.serif, color: T.ink.base }}
                >
                  {team.name}
                </h3>
                <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
                  {team.role === "organiser"
                    ? "You organise it"
                    : team.organiserName
                      ? `Organised by ${team.organiserName}`
                      : "Member"}
                  {" · "}
                  {team.libraryCount}{" "}
                  {team.libraryCount === 1 ? "library" : "libraries"}
                  {!active ? " · not active" : ""}
                </p>
                {covered.length ? (
                  <p
                    className="m-0 mt-1 text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    Your libraries here:{" "}
                    {covered.map((lib, i) => (
                      <span key={lib.id}>
                        {i > 0 ? ", " : ""}
                        <Link
                          href={staffLibraryHref(lib.slug)}
                          className="font-semibold underline"
                          style={{ color: T.ink.base }}
                        >
                          {lib.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/staff/team?team=${team.id}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {team.role === "organiser" ? "Manage the team" : "See the team"}
                <Icon
                  aria-hidden="true"
                  height={15}
                  icon="mdi:arrow-right"
                  width={15}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
