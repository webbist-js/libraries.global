"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { BADGE_CATALOG } from "@/lib/badges"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { resolvePublicPrefs, type UserProfile } from "@/lib/types/profile"

import { ContributionHeatmap } from "../ContributionHeatmap"
import {
  BadgeTile,
  CARD,
  ContributionRow,
  SectionTitle,
  StatCard,
} from "../ProfileSectionUI"

// ── Main component ────────────────────────────────────────────────────────────

export function OverviewSection({
  profile,
  isOwner = false,
}: {
  profile: UserProfile
  isOwner?: boolean
}) {
  const [allContribs, setAllContribs] = useState<PublicSubmission[]>([])
  const [now] = useState<number>(() => Date.now())
  const prefs = resolvePublicPrefs(profile.publicPrefs)
  const canSee = (pref: boolean) => isOwner || pref

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(profile.username)}/contributions`)
      .then((r) => r.json())
      .then((json: { data?: PublicSubmission[] }) => {
        setAllContribs(json.data ?? [])
      })
      .catch(() => {})
  }, [profile.username])

  const stats = useMemo(() => {
    const accepted = allContribs.filter((c) => c.status === "approved").length
    const inReview = allContribs.filter((c) => c.status === "pending").length
    const added = allContribs.filter(
      (c) => c.submissionType === "new_library" && c.status === "approved"
    ).length

    return { accepted, inReview, added }
  }, [allContribs])

  const recentContribs = useMemo(() => allContribs.slice(0, 5), [allContribs])

  const earnedSet = new Set((profile.earnedBadges ?? []).map((b) => b.badgeId))
  const previewBadges = [
    ...BADGE_CATALOG.filter((b) => earnedSet.has(b.id)),
    ...BADGE_CATALOG.filter((b) => !earnedSet.has(b.id)),
  ].slice(0, 6)

  const facts: { label: string; value: string }[] = [
    (profile.city || profile.country) && canSee(prefs.showLocation)
      ? {
          label: "Location",
          value: [profile.city, profile.country].filter(Boolean).join(", "),
        }
      : null,
    profile.affiliation && canSee(prefs.showAffiliation)
      ? { label: "Affiliation", value: profile.affiliation }
      : null,
    profile.jobTitle ? { label: "Role", value: profile.jobTitle } : null,
    profile.languages?.length
      ? {
          label: "Languages",
          value: profile.languages.map((l) => l.code.toUpperCase()).join(" · "),
        }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const links: { icon: string; label: string; href: string }[] = []
  if (profile.website)
    links.push({
      icon: "mdi:web",
      label: profile.website.replace(/^https?:\/\//, ""),
      href: profile.website.startsWith("http")
        ? profile.website
        : `https://${profile.website}`,
    })
  if (profile.orcid)
    links.push({
      icon: "mdi:identifier",
      label: `ORCID · ${profile.orcid}`,
      href: `https://orcid.org/${profile.orcid}`,
    })
  if (profile.mastodon)
    links.push({
      icon: "mdi:mastodon",
      label: profile.mastodon.replace(/^https?:\/\//, ""),
      href: profile.mastodon.startsWith("http")
        ? profile.mastodon
        : `https://${profile.mastodon}`,
    })
  if (profile.linkedin)
    links.push({
      icon: "mdi:linkedin",
      label: profile.linkedin.replace(/^https?:\/\//, ""),
      href: `https://linkedin.com/in/${profile.linkedin}`,
    })

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <h2 className="sr-only">Contribution summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Changes accepted"
          value={String(stats.accepted)}
          bg="var(--tint-public-bg)"
          fg="var(--tint-public-fg)"
          icon="mdi:check-circle-outline"
        />
        <StatCard
          label="In review"
          value={String(stats.inReview)}
          bg="var(--tint-academic-bg)"
          fg="var(--tint-academic-fg)"
          icon="mdi:clock-outline"
        />
        <StatCard
          label="Libraries stewarded"
          value={String(profile.claimedLibraries?.length ?? 0)}
          bg="var(--tint-national-bg)"
          fg="var(--tint-national-fg)"
          icon="mdi:shield-check-outline"
        />
        <StatCard
          label="Libraries added"
          value={String(stats.added)}
          bg="#F5EEDC"
          fg="#6B5420"
          icon="mdi:book-plus-outline"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-6">
          {canSee(prefs.showActivity) ? (
            <>
              <h2 className="sr-only">Activity</h2>
              <ContributionHeatmap submissions={allContribs} now={now} />
            </>
          ) : null}

          {/* Recent contributions */}
          <section aria-labelledby="ov-contribs" style={CARD}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span id="ov-contribs">
                <SectionTitle>Contributions</SectionTitle>
              </span>
              <Link
                href={`/profile/${profile.username}/contributions`}
                className="text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                style={{ color: T.accent.primary }}
              >
                See all
              </Link>
            </div>
            {recentContribs.length === 0 ? (
              <p
                className="m-0 border-t px-6 py-6 text-[15px]"
                style={{ borderTopColor: T.border.divider, color: T.ink.dim }}
              >
                No contributions yet.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {recentContribs.map((item) => (
                  <ContributionRow key={item.documentId} item={item} />
                ))}
              </ul>
            )}
          </section>

          {/* Recognition preview */}
          <section
            aria-labelledby="ov-recognition"
            style={{ ...CARD, padding: "20px 24px 24px" }}
          >
            <div className="flex items-center justify-between pb-4">
              <span id="ov-recognition">
                <SectionTitle>Recognition</SectionTitle>
              </span>
              <Link
                href={`/profile/${profile.username}/badges`}
                className="text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                style={{ color: T.accent.primary }}
              >
                All badges
              </Link>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {previewBadges.map((b) => (
                <BadgeTile key={b.id} badge={b} earned={earnedSet.has(b.id)} />
              ))}
            </ul>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          {/* Libraries */}
          <section
            aria-labelledby="ov-libraries"
            style={{ ...CARD, padding: "20px 22px" }}
          >
            <h3
              id="ov-libraries"
              className="m-0 mb-3 text-[14px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Libraries
            </h3>
            {(profile.claimedLibraries?.length ?? 0) > 0 ? (
              <div className="mb-3">
                <p
                  className="m-0 mb-1 text-[13px] font-semibold tracking-wide uppercase"
                  style={{ color: T.ink.low }}
                >
                  Represents
                </p>
                {profile.claimedLibraries!.map((lib) => (
                  <p
                    key={lib.documentId ?? lib.entityRef}
                    className="m-0 py-0.5"
                  >
                    <span
                      className="text-[15px] font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {lib.name}
                    </span>{" "}
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--tint-public-fg)" }}
                    >
                      · steward
                    </span>
                  </p>
                ))}
              </div>
            ) : null}
            {canSee(prefs.showFollows) ? (
              <>
                <p
                  className="m-0 mb-1 text-[13px] font-semibold tracking-wide uppercase"
                  style={{ color: T.ink.low }}
                >
                  Follows
                </p>
                {(profile.followedLibraries?.length ?? 0) === 0 ? (
                  <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                    Not following any libraries yet.
                  </p>
                ) : (
                  <>
                    {profile.followedLibraries!.slice(0, 4).map((lib) => (
                      <p key={lib.documentId} className="m-0 truncate py-0.5">
                        <span
                          className="text-[15px]"
                          style={{ color: T.ink.base }}
                        >
                          {lib.name}
                        </span>
                      </p>
                    ))}
                    <Link
                      href={`/profile/${profile.username}/following`}
                      className="mt-1 inline-block text-[14px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                      style={{ color: T.accent.primary }}
                    >
                      All {profile.followedLibraries!.length} followed
                    </Link>
                  </>
                )}
              </>
            ) : null}
          </section>

          {/* Contributor level */}
          {(profile.tier || profile.points != null) && (
            <section
              aria-labelledby="ov-level"
              style={{
                border: "1px solid transparent",
                borderRadius: "20px",
                background: "var(--tint-national-bg)",
                padding: "20px 22px",
              }}
            >
              <h3
                id="ov-level"
                className="m-0 mb-2 text-[14px] font-semibold"
                style={{ color: "var(--tint-national-fg)" }}
              >
                Contributor level
              </h3>
              <p
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "30px",
                  fontWeight: 500,
                  color: T.ink.base,
                }}
              >
                {profile.tier ?? "Contributor"}
              </p>
              {profile.points != null ? (
                <p
                  className="m-0 mt-1 text-[15px]"
                  style={{ color: T.ink.dim }}
                >
                  {profile.points.toLocaleString()} points
                  {profile.streak ? ` · ${profile.streak}-day streak` : ""}
                </p>
              ) : null}
              <Link
                href="/docs"
                className="mt-2 inline-block text-[14px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                How levels work
              </Link>
            </section>
          )}

          {/* Facts */}
          {facts.length > 0 && (
            <section
              aria-labelledby="ov-facts"
              style={{ ...CARD, padding: "20px 22px" }}
            >
              <h3
                id="ov-facts"
                className="m-0 mb-2 text-[14px] font-semibold"
                style={{ color: T.ink.base }}
              >
                About
              </h3>
              <dl className="m-0">
                {facts.map((f) => (
                  <div
                    key={f.label}
                    className="grid grid-cols-[96px_1fr] gap-2.5 border-b py-2 last:border-b-0"
                    style={{ borderBottomColor: T.border.divider }}
                  >
                    <dt
                      className="text-[13px] font-semibold"
                      style={{ color: T.ink.low }}
                    >
                      {f.label}
                    </dt>
                    <dd
                      className="m-0 text-[15px]"
                      style={{ color: T.ink.base }}
                    >
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Links */}
          {links.length > 0 && (
            <section
              aria-labelledby="ov-links"
              style={{
                border: "1px solid transparent",
                borderRadius: "20px",
                background: "var(--tint-national-bg)",
                padding: "20px 22px",
              }}
            >
              <h3
                id="ov-links"
                className="m-0 mb-2 text-[14px] font-semibold"
                style={{ color: "var(--tint-national-fg)" }}
              >
                Links
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[15px] font-semibold underline underline-offset-[3px]"
                      style={{ color: T.accent.primary }}
                    >
                      <Icon
                        icon={l.icon}
                        width={16}
                        height={16}
                        aria-hidden="true"
                      />
                      <span className="max-w-[200px] truncate">{l.label}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
