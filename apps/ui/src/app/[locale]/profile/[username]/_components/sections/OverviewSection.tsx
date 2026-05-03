"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { BADGE_CATALOG, BADGE_VARIANT_STYLES } from "@/lib/badges"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { ContributionHeatmap } from "../ContributionHeatmap"
import { FollowedLibrariesGrid } from "../FollowedLibrariesGrid"

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: T.bg.surface,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "2px",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span
          style={{
            fontFamily: T.font.serif,
            fontSize: "36px",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            color: T.ink.base,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            letterSpacing: ".04em",
            marginTop: "2px",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

const CONTRIB_TYPE_META: Record<
  string,
  { color: string; bg: string; border: string; icon: string; label: string }
> = {
  new_library: {
    color: T.accent.ok,
    bg: "rgba(142,240,179,0.1)",
    border: "rgba(142,240,179,0.25)",
    icon: "mdi:book-plus-outline",
    label: "Added",
  },
  library_edit: {
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.1)",
    border: "rgba(127,223,255,0.25)",
    icon: "mdi:pencil-outline",
    label: "Edited",
  },
  correction: {
    color: T.accent.gold,
    bg: "rgba(232,201,138,0.1)",
    border: "rgba(232,201,138,0.25)",
    icon: "mdi:flag-outline",
    label: "Correction",
  },
  wiki_edit: {
    color: T.accent.violet,
    bg: "rgba(163,144,255,0.1)",
    border: "rgba(163,144,255,0.25)",
    icon: "mdi:book-edit-outline",
    label: "Wiki",
  },
  library_claim: {
    color: T.accent.gold,
    bg: "rgba(232,201,138,0.1)",
    border: "rgba(232,201,138,0.25)",
    icon: "mdi:shield-check-outline",
    label: "Claimed",
  },
  default: {
    color: T.ink.dim,
    bg: T.bg.deep,
    border: T.border.line,
    icon: "mdi:message-text-outline",
    label: "Other",
  },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  const d = Math.floor(diff / 86_400_000)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`

  return `${Math.floor(d / 30)}mo ago`
}

function approxPoints(type: string): number | null {
  if (type === "new_library") return 50
  if (type === "library_edit") return 10
  if (type === "wiki_edit") return 5

  return null
}

const CONTRIB_FALLBACK = CONTRIB_TYPE_META.default!

// Badge widget shows up to 8 badges from the catalog (earned first)
const BADGE_WIDGET_COUNT = 8

// ── Main component ─────────────────────────────────────────────────────────────

export function OverviewSection({ profile }: { profile: UserProfile }) {
  const [allContribs, setAllContribs] = useState<PublicSubmission[]>([])
  const [now] = useState<number>(() => Date.now())

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(profile.username)}/contributions`)
      .then((r) => r.json())
      .then((json: { data?: PublicSubmission[] }) => {
        setAllContribs(json.data ?? [])
      })
      .catch(() => {})
  }, [profile.username])

  const recentContribs = useMemo(() => allContribs.slice(0, 5), [allContribs])
  const joinedDate = new Date(profile.createdAt)
  const memberSince = joinedDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  /* eslint-disable react-hooks/purity */
  const memberYears = useMemo(
    () =>
      (
        (Date.now() - joinedDate.getTime()) /
        (1000 * 60 * 60 * 24 * 365.25)
      ).toFixed(1),
    [joinedDate]
  )
  /* eslint-enable react-hooks/purity */

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

  const facts: { label: string; value: string }[] = [
    profile.city || profile.country
      ? {
          label: "Location",
          value: [profile.city, profile.country].filter(Boolean).join(", "),
        }
      : null,
    profile.affiliation
      ? { label: "Affiliation", value: profile.affiliation }
      : null,
    profile.jobTitle ? { label: "Role", value: profile.jobTitle } : null,
    { label: "Member since", value: `${memberSince} (${memberYears} yrs)` },
    profile.languages?.length
      ? {
          label: "Languages",
          value: profile.languages.map((l) => l.code.toUpperCase()).join(" · "),
        }
      : null,
    profile.interests?.length
      ? {
          label: "Interests",
          value: profile.interests
            .map((i) => i.name)
            .slice(0, 3)
            .join(" · "),
        }
      : null,
    profile.timezone ? { label: "Timezone", value: profile.timezone } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "18px",
          overflow: "hidden",
          background: T.border.line,
        }}
      >
        <StatCell
          label="Contributions"
          value="—"
          sub="Edits & additions · lifetime"
        />
        <StatCell
          label="Libraries Indexed"
          value="—"
          sub="Added from scratch"
        />
        <StatCell label="Reputation" value="—" sub="Reputation score / 10" />
        {(profile.streak ?? 0) > 0 ? (
          <StatCell label="Day streak" value={String(profile.streak)} />
        ) : (
          <StatCell label="Streak" value="—" sub="Current consecutive days" />
        )}
        {profile.tier != null && <StatCell label="Tier" value={profile.tier} />}
        {profile.points != null && (
          <StatCell
            label="Total points"
            value={profile.points.toLocaleString()}
          />
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_272px]">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Activity heatmap */}
          <ContributionHeatmap submissions={allContribs} now={now} />

          {/* Recent contributions */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "16px",
              overflow: "hidden",
              background: T.bg.surface,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 14px",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                Recent contributions
              </p>
              <Link
                href={`/profile/${profile.username}/contributions`}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.7,
                  textDecoration: "none",
                }}
              >
                See all →
              </Link>
            </div>

            {recentContribs.length === 0 ? (
              <div
                style={{
                  padding: "24px 20px",
                  borderTop: `1px solid ${T.border.line}`,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    margin: 0,
                  }}
                >
                  No contributions yet
                </p>
              </div>
            ) : (
              <div>
                {recentContribs.map((item) => {
                  const t =
                    CONTRIB_TYPE_META[item.submissionType] ?? CONTRIB_FALLBACK
                  const pts = approxPoints(item.submissionType)

                  return (
                    <div
                      key={item.documentId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "12px 20px",
                        borderTop: `1px solid ${T.border.line}`,
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "10px",
                          border: `1px solid ${t.border}`,
                          background: t.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon
                          icon={t.icon}
                          width={17}
                          height={17}
                          style={{ color: t.color }}
                        />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "3px",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "7px",
                              letterSpacing: ".14em",
                              textTransform: "uppercase",
                              color: t.color,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              border: `1px solid ${t.border}`,
                              background: t.bg,
                            }}
                          >
                            {t.label}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: T.ink.base,
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.targetLabel ??
                              item.targetSlug ??
                              item.submissionType}
                          </span>
                        </div>
                        {item.editSummary && (
                          <p
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "9px",
                              letterSpacing: ".06em",
                              color: T.ink.faint,
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.editSummary}
                          </p>
                        )}
                      </div>

                      {/* Right: time + points */}
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <p
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            color: T.ink.faint,
                            margin: "0 0 2px",
                            textTransform: "uppercase",
                            letterSpacing: ".06em",
                          }}
                        >
                          {relativeTime(item.createdAt)}
                        </p>
                        {item.status === "approved" && pts !== null && (
                          <p
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "9px",
                              color: T.accent.ok,
                              margin: 0,
                              fontWeight: 600,
                            }}
                          >
                            +{pts} pts
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Following libraries */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "16px",
              padding: "20px 22px 22px",
              background: T.bg.surface,
            }}
          >
            <p
              style={{
                fontFamily: T.font.serif,
                fontSize: "16px",
                fontWeight: 600,
                color: T.ink.base,
                margin: "0 0 16px",
              }}
            >
              Following libraries
            </p>
            <FollowedLibrariesGrid
              libraries={profile.followedLibraries ?? []}
              username={profile.username}
              variant="compact"
              max={6}
            />
          </div>

          {/* Claimed libraries */}
          {(profile.claimedLibraries ?? []).length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "20px 22px 22px",
                background: T.bg.surface,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <p
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: T.ink.base,
                    margin: 0,
                  }}
                >
                  Claimed libraries
                </p>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {profile.claimedLibraries!.length} managed
                </span>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {profile.claimedLibraries!.map((lib) => (
                  <Link
                    key={lib.entityRef ?? lib.documentId}
                    href={lib.slug ? `/library/${lib.slug}` : "#"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      border: `1px solid ${T.border.line}`,
                      borderRadius: "10px",
                      background: T.bg.surface,
                      textDecoration: "none",
                      transition: "background 150ms, border-color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = "rgba(127,223,255,0.04)"
                      el.style.borderColor = "rgba(127,223,255,0.22)"
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = "var(--t-bg-surface)"
                      el.style.borderColor = T.border.line
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "13px",
                          fontWeight: 500,
                          color: T.ink.base,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lib.name}
                      </span>
                      {lib.entityRef && (
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            letterSpacing: ".10em",
                            textTransform: "uppercase",
                            color: T.ink.faint,
                          }}
                        >
                          {lib.entityRef}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexShrink: 0,
                        marginLeft: "12px",
                      }}
                    >
                      {lib.libraryType && (
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            letterSpacing: ".10em",
                            textTransform: "uppercase",
                            color: T.ink.faint,
                            border: `1px solid ${T.border.line}`,
                            borderRadius: "5px",
                            padding: "3px 8px",
                          }}
                        >
                          {lib.libraryType}
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          letterSpacing: ".10em",
                          textTransform: "uppercase",
                          color: T.accent.ok,
                          border: `1px solid ${T.accent.ok}30`,
                          borderRadius: "5px",
                          padding: "3px 8px",
                        }}
                      >
                        Manager
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Facts */}
          {facts.length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "18px 20px",
                background: T.bg.surface,
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontWeight: 400,
                  color: T.ink.base,
                  margin: "0 0 14px",
                  letterSpacing: "-0.015em",
                }}
              >
                Facts
              </p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {facts.map((f, i) => (
                  <div
                    key={f.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr",
                      gap: "10px",
                      padding: "8px 0",
                      borderBottom:
                        i < facts.length - 1
                          ? `1px dashed ${T.border.line}`
                          : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "9px",
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        color: T.ink.faint,
                        paddingTop: "1px",
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: T.ink.base,
                        lineHeight: "1.5",
                      }}
                    >
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "16px",
              padding: "18px 20px",
              background: T.bg.surface,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontWeight: 400,
                  color: T.ink.base,
                  margin: 0,
                  letterSpacing: "-0.015em",
                }}
              >
                Badges earned
              </p>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  color: T.ink.faint,
                  letterSpacing: ".12em",
                }}
              >
                {(profile.earnedBadges ?? []).length} of {BADGE_CATALOG.length}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
              }}
            >
              {(() => {
                const earnedSet = new Set(
                  (profile.earnedBadges ?? []).map((b) => b.badgeId)
                )
                const displayed = [
                  ...BADGE_CATALOG.filter((b) => earnedSet.has(b.id)),
                  ...BADGE_CATALOG.filter((b) => !earnedSet.has(b.id)),
                ].slice(0, BADGE_WIDGET_COUNT)

                return displayed.map((b) => {
                  const earned = earnedSet.has(b.id)
                  const vs = earned
                    ? BADGE_VARIANT_STYLES[b.variant]
                    : {
                        border: T.border.line,
                        bg: T.bg.surface,
                        color: T.ink.ghost,
                      }

                  return (
                    <div
                      key={b.id}
                      title={b.name}
                      className="transition-transform duration-150 hover:-translate-y-0.5"
                      style={{
                        aspectRatio: "1",
                        borderRadius: "12px",
                        border: `1px solid ${vs.border}`,
                        background: vs.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: earned ? 1 : 0.35,
                      }}
                    >
                      <Icon
                        icon={earned ? b.icon : "mdi:lock-outline"}
                        width={18}
                        height={18}
                        style={{ color: vs.color }}
                      />
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Links */}
          {links.length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "18px 20px",
                background: T.bg.surface,
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontWeight: 400,
                  color: T.ink.base,
                  margin: "0 0 12px",
                  letterSpacing: "-0.015em",
                }}
              >
                Links
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      background: "transparent",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--t-bg-surface)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <Icon
                        icon={l.icon}
                        width={14}
                        height={14}
                        style={{ color: T.ink.faint, flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "11px",
                          color: T.ink.dim,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "160px",
                        }}
                      >
                        {l.label}
                      </span>
                    </div>
                    <Icon
                      icon="mdi:arrow-top-right"
                      width={11}
                      height={11}
                      style={{ color: T.ink.faint, flexShrink: 0 }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
