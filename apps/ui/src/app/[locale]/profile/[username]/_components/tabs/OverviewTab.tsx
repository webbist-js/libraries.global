"use client"

import { Icon } from "@iconify/react"
import { useMemo } from "react"

import { T } from "@/lib/design-tokens"
import type { FollowedLibrary, UserProfile } from "@/lib/types/profile"

// ── Seeded pseudo-random heatmap ──────────────────────────────────────────────

function seededRandom(base: number, i: number): number {
  const x = Math.sin(base * 9301 + i * 49297 + 233720) * 10_000

  return x - Math.floor(x)
}

function generateHeatmap(username: string): number[] {
  let seed = 0
  for (const c of username) seed += c.codePointAt(0) ?? 0

  return Array.from({ length: 182 }, (_, i) => {
    const r = seededRandom(seed, i)
    if (r < 0.54) return 0
    if (r < 0.71) return Math.ceil(r * 4)
    if (r < 0.87) return Math.ceil(r * 9)

    return Math.ceil(r * 18)
  })
}

function heatColor(v: number): string {
  if (v === 0) return "rgba(255,255,255,0.05)"
  if (v <= 3) return "rgba(127,223,255,0.16)"
  if (v <= 8) return "rgba(127,223,255,0.38)"
  if (v <= 14) return "rgba(127,223,255,0.62)"

  return "rgba(127,223,255,0.88)"
}

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
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "8px",
          letterSpacing: ".2em",
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
            fontSize: "34px",
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
            fontSize: "9px",
            color: T.ink.faint,
            letterSpacing: ".06em",
            marginTop: "2px",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

const CONTRIB_TYPES = {
  ADDED: {
    color: T.accent.ok,
    bg: "rgba(142,240,179,0.1)",
    border: "rgba(142,240,179,0.25)",
  },
  EDITED: {
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.1)",
    border: "rgba(127,223,255,0.25)",
  },
  FLAGGED: {
    color: T.accent.gold,
    bg: "rgba(232,201,138,0.1)",
    border: "rgba(232,201,138,0.25)",
  },
  REVIEWED: {
    color: T.ink.dim,
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.1)",
  },
  PHOTO: {
    color: T.accent.violet,
    bg: "rgba(163,144,255,0.1)",
    border: "rgba(163,144,255,0.25)",
  },
} as const

const PLACEHOLDER_CONTRIBS = [
  {
    type: "ADDED" as const,
    title: "Bibliothèque Méjanes · Aix-en-Provence",
    sub: "FR · Public · 320,000 items · Fully verified",
    time: "2H AGO",
    rep: "+18 REP",
  },
  {
    type: "EDITED" as const,
    title: "Hours for British Library · Reading-room closures",
    sub: "GB · National · Peer-reviewed",
    time: "Yesterday",
    rep: "+3 REP",
  },
  {
    type: "FLAGGED" as const,
    title: "Duplicate entry · National Library of Wales",
    sub: "GB-WLS · Merged by editor",
    time: "2 days ago",
    rep: "+5 REP",
  },
  {
    type: "REVIEWED" as const,
    title: "Translation · Biblioteca Apostolica Vaticana FR",
    sub: "VA · Approved by editorial board",
    time: "4 days ago",
    rep: "+12 REP",
  },
  {
    type: "PHOTO" as const,
    title: "Photography added for Bibliothèque Mazarine",
    sub: "FR · 6 images · IIIF endpoint",
    time: "1 week ago",
    rep: "+8 REP",
  },
]

const CONTRIB_ICONS = {
  ADDED: "mdi:book-plus-outline",
  EDITED: "mdi:pencil-outline",
  FLAGGED: "mdi:flag-outline",
  REVIEWED: "mdi:message-text-outline",
  PHOTO: "mdi:camera-outline",
}

const LIBRARY_TYPE_GRADIENT: Record<string, string> = {
  National: "linear-gradient(135deg, #0a1a2d 0%, #0d0d2e 100%)",
  Public: "linear-gradient(135deg, #0a1f1a 0%, #071428 100%)",
  Academic: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  University: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  Parliamentary: "linear-gradient(135deg, #1a0a0d 0%, #0d0a1a 100%)",
  Monastic: "linear-gradient(135deg, #1a0a2d 0%, #2d1a0a 100%)",
  Archive: "linear-gradient(135deg, #1a100a 0%, #0d1a1a 100%)",
}

function libraryGradient(type?: string | null): string {
  return (
    LIBRARY_TYPE_GRADIENT[type ?? ""] ??
    "linear-gradient(135deg, #0a0d1a 0%, #0d0a2e 100%)"
  )
}

function FollowingLibrariesGrid({
  libraries,
}: {
  libraries: FollowedLibrary[]
}) {
  if (libraries.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          border: `1px solid ${T.border.line}`,
          borderRadius: "10px",
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: 0,
          }}
        >
          No libraries followed yet
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px",
      }}
    >
      {libraries.slice(0, 6).map((lib) => (
        <div
          key={lib.documentId}
          style={{
            borderRadius: "10px",
            border: `1px solid ${T.border.line}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "80px",
              background: libraryGradient(lib.libraryType),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {lib.libraryType && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "8px",
                  fontFamily: T.font.mono,
                  fontSize: "7px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.ink.dim,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(0,0,0,0.4)",
                }}
              >
                {lib.libraryType}
              </div>
            )}
            <Icon
              icon="mdi:domain"
              width={28}
              height={28}
              style={{ color: "rgba(255,255,255,0.12)" }}
            />
          </div>
          <div style={{ padding: "10px 12px" }}>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "12px",
                fontWeight: 500,
                color: T.ink.base,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {lib.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const BADGE_ICONS = [
  { icon: "mdi:pencil", earned: true },
  { icon: "mdi:star-outline", earned: true },
  { icon: "mdi:map-outline", earned: true },
  { icon: "mdi:translate", earned: true },
  { icon: "mdi:book-outline", earned: true },
  { icon: "mdi:lightning-bolt", earned: true },
  { icon: "mdi:check-circle-outline", earned: false },
  { icon: "mdi:lock-outline", earned: false },
]

// ── Main component ─────────────────────────────────────────────────────────────

export function OverviewTab({ profile }: { profile: UserProfile }) {
  const heat = generateHeatmap(profile.username)
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
    profile.role ? { label: "Role", value: profile.role } : null,
    { label: "Member since", value: `${memberSince} (${memberYears} yrs)` },
    profile.languages?.length
      ? {
          label: "Languages",
          value: profile.languages.map((l) => l.code.toUpperCase()).join(" · "),
        }
      : null,
    profile.interests?.length
      ? { label: "Interests", value: profile.interests.slice(0, 3).join(" · ") }
      : null,
    profile.timezone ? { label: "Timezone", value: profile.timezone } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
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
        <StatCell label="Streak" value="—" sub="Current consecutive days" />
        {profile.tier != null && <StatCell label="Tier" value={profile.tier} />}
        {profile.points != null && (
          <StatCell
            label="Total points"
            value={profile.points.toLocaleString()}
          />
        )}
        {(profile.streak ?? 0) > 0 && (
          <StatCell label="Day streak" value={String(profile.streak)} />
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_272px]">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Activity heatmap */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "12px",
              padding: "20px",
              background: "rgba(255,255,255,0.02)",
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
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                Activity
              </p>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.7,
                }}
              >
                § Last 26 weeks
              </span>
            </div>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "8px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
                margin: "0 0 10px",
              }}
            >
              Daily contribution graph
            </p>

            {/* Grid: 26 columns (weeks) × 7 rows (days) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(26, 1fr)",
                gap: "3px",
              }}
            >
              {Array.from({ length: 26 }, (_, col) =>
                Array.from({ length: 7 }, (_, row) => {
                  const idx = col * 7 + row
                  const v = heat[idx] ?? 0

                  return (
                    <div
                      key={`${col}-${row}`}
                      title={v > 0 ? `${v} contributions` : "No contributions"}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "2px",
                        background: heatColor(v),
                        cursor: "default",
                      }}
                    />
                  )
                })
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "10px",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".1em",
                  color: T.ink.faint,
                }}
              >
                Mon – Sun, last 182 days
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "8px",
                    color: T.ink.faint,
                  }}
                >
                  Less
                </span>
                {[0, 2, 5, 10, 16].map((v, i) => (
                  <div
                    key={i}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "2px",
                      background: heatColor(v),
                    }}
                  />
                ))}
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "8px",
                    color: T.ink.faint,
                  }}
                >
                  More
                </span>
              </div>
            </div>
          </div>

          {/* Recent contributions */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "12px",
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)",
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
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.7,
                  cursor: "default",
                }}
              >
                See all —
              </span>
            </div>

            <div>
              {PLACEHOLDER_CONTRIBS.map((item, i) => {
                const t = CONTRIB_TYPES[item.type]

                return (
                  <div
                    key={i}
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
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        border: `1px solid ${t.border}`,
                        background: t.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        icon={CONTRIB_ICONS[item.type]}
                        width={15}
                        height={15}
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
                          {item.type}
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
                          {item.title}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          letterSpacing: ".06em",
                          color: T.ink.faint,
                          margin: 0,
                          textTransform: "uppercase",
                        }}
                      >
                        {item.sub}
                      </p>
                    </div>

                    {/* Right: time + rep */}
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
                        {item.time}
                      </p>
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          color: T.accent.ok,
                          margin: 0,
                          fontWeight: 600,
                        }}
                      >
                        {item.rep}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Following libraries */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "12px",
              padding: "18px 20px 20px",
              background: "rgba(255,255,255,0.02)",
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
                Following libraries
              </p>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.7,
                  cursor: "default",
                }}
              >
                See all —
              </span>
            </div>

            <FollowingLibrariesGrid
              libraries={profile.followedLibraries ?? []}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Facts */}
          {facts.length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: T.ink.base,
                  margin: "0 0 14px",
                }}
              >
                Facts
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {facts.map((f) => (
                  <div
                    key={f.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 1fr",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "8px",
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        color: T.ink.faint,
                        paddingTop: "1px",
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
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
              borderRadius: "12px",
              padding: "16px 18px",
              background: "rgba(255,255,255,0.02)",
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
                  fontSize: "14px",
                  fontWeight: 600,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                Badges earned
              </p>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  color: T.ink.faint,
                }}
              >
                — of 28
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
              }}
            >
              {BADGE_ICONS.map((b, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "10px",
                    border: `1px solid ${b.earned ? T.border.hi : T.border.line}`,
                    background: b.earned
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.02)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    icon={b.earned ? b.icon : "mdi:lock-outline"}
                    width={18}
                    height={18}
                    style={{
                      color: b.earned ? T.ink.dim : "rgba(255,255,255,0.12)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          {links.length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: T.ink.base,
                  margin: "0 0 12px",
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
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)"
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
