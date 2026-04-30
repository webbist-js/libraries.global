import { headers } from "next/headers"

import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import type { LeaderboardEntry } from "../_components/ContributeCommunitySection"
import { ContributeNavBar } from "../_components/ContributeNavBar"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY
const SECRET = process.env.STRAPI_BRIDGE_SECRET

type Period = "today" | "week" | "month" | "all"

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
]

const TIER_COLORS: Record<string, string> = {
  Reader: T.ink.faint,
  Indexer: T.ink.dim,
  Cartographer: T.accent.aurora,
  Archivist: T.accent.violet,
  Scholar: T.accent.gold,
  Curator: T.accent.gold,
}

type Standing = {
  globalRank: number | null
  tier: {
    level: number
    name: string
    nextName: string | null
    nextThreshold: number | null
    progressPercent: number
  }
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

async function fetchLeaderboard(period: Period): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard?period=${period}&limit=50`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }

    return json.data ?? []
  } catch {
    return []
  }
}

async function fetchStanding(baUserId: string): Promise<Standing | null> {
  if (!SECRET) return null
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": baUserId,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Standing }

    return json.data ?? null
  } catch {
    return null
  }
}

function getDisplayName(entry: LeaderboardEntry): string {
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ")

  return full || entry.username || `User ${entry.baUserId.slice(0, 6)}`
}

function getInitials(entry: LeaderboardEntry): string {
  const first = entry.firstName?.[0] ?? ""
  const last = entry.lastName?.[0] ?? ""

  return (
    (first + last).toUpperCase() ||
    (entry.username?.slice(0, 2).toUpperCase() ?? "??")
  )
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period: Period = ["today", "week", "month", "all"].includes(
    periodParam ?? ""
  )
    ? (periodParam as Period)
    : "month"

  const session = await getSessionSSR(await headers())

  const [entries, standing] = await Promise.all([
    fetchLeaderboard(period),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
  ])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg.space,
        color: T.ink.base,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 pt-20 pb-10 md:px-10">
        {/* Breadcrumb */}
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.low,
            display: "flex",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          <GlobalLink
            href="/"
            style={{ color: T.ink.low, textDecoration: "none" }}
          >
            Atlas
          </GlobalLink>
          <span>/</span>
          <GlobalLink
            href="/contribute"
            style={{ color: T.ink.low, textDecoration: "none" }}
          >
            Contribute
          </GlobalLink>
          <span>/</span>
          <span style={{ color: T.ink.base }}>Community</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: "40px" }}>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              color: T.ink.base,
              margin: "0 0 14px",
            }}
          >
            The community,{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: "rgba(244,247,255,0.55)",
              }}
            >
              in numbers.
            </em>
          </h1>
          <p style={{ fontSize: "15px", color: T.ink.faint, maxWidth: "52ch" }}>
            Contributors who keep the atlas accurate and growing. Points are
            earned for every approved contribution.
          </p>
        </div>
      </div>

      <ContributeNavBar />

      <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-20 md:px-10">
        {/* Period tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "32px",
            borderBottom: `1px solid ${T.border.line}`,
          }}
        >
          {PERIODS.map(({ key, label }) => (
            <GlobalLink
              key={key}
              href={`/contribute/community?period=${key}`}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: period === key ? T.accent.aurora : T.ink.faint,
                textDecoration: "none",
                padding: "10px 16px",
                borderBottom:
                  period === key
                    ? `2px solid ${T.accent.aurora}`
                    : "2px solid transparent",
                marginBottom: "-1px",
                transition: "color 150ms",
              }}
            >
              {label}
            </GlobalLink>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: "32px",
            alignItems: "start",
          }}
        >
          {/* Left: podium + ranked list */}
          <div>
            {entries.length === 0 ? (
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: T.ink.faint,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                No contributions recorded for this period yet.
              </p>
            ) : (
              <>
                {/* Podium: top 3 */}
                {podium.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${podium.length}, 1fr)`,
                      gap: "12px",
                      marginBottom: "24px",
                    }}
                  >
                    {podium.map((entry) => (
                      <div
                        key={entry.baUserId}
                        style={{
                          padding: "20px 16px",
                          borderRadius: "12px",
                          border: `1px solid ${entry.rank === 1 ? T.accent.gold + "40" : T.border.line}`,
                          background:
                            entry.rank === 1
                              ? "rgba(232,201,138,0.04)"
                              : "rgba(255,255,255,0.015)",
                          textAlign: "center",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: T.font.serif,
                            fontSize: "32px",
                            fontWeight: 400,
                            color:
                              entry.rank === 1 ? T.accent.gold : T.ink.faint,
                            lineHeight: 1,
                            marginBottom: "12px",
                          }}
                        >
                          {entry.rank}
                        </div>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: "rgba(127,223,255,0.10)",
                            border: "1px solid rgba(127,223,255,0.18)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: T.font.mono,
                            fontSize: "12px",
                            fontWeight: 600,
                            color: T.accent.aurora,
                            margin: "0 auto 10px",
                            overflow: "hidden",
                          }}
                        >
                          {entry.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            getInitials(entry)
                          )}
                        </div>
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: "14px",
                            fontWeight: 500,
                            color: T.ink.base,
                          }}
                        >
                          {getDisplayName(entry)}
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px",
                            fontFamily: T.font.mono,
                            fontSize: "8px",
                            letterSpacing: ".10em",
                            textTransform: "uppercase",
                            color: TIER_COLORS[entry.tier] ?? T.ink.faint,
                          }}
                        >
                          {entry.tier}
                          {entry.country ? ` · ${entry.country}` : ""}
                        </p>
                        <div>
                          <span
                            style={{
                              fontFamily: T.font.serif,
                              fontSize: "24px",
                              fontWeight: 400,
                              letterSpacing: "-0.02em",
                              color: T.ink.base,
                            }}
                          >
                            {entry.periodPoints.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "8px",
                              letterSpacing: ".12em",
                              textTransform: "uppercase",
                              color: T.ink.faint,
                              marginLeft: "6px",
                            }}
                          >
                            pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ranked list rows 4+ */}
                {rest.length > 0 && (
                  <div
                    style={{
                      border: `1px solid ${T.border.line}`,
                      borderRadius: "12px",
                      overflow: "hidden",
                    }}
                  >
                    {rest.map((entry, i) => (
                      <div
                        key={entry.baUserId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "12px 20px",
                          borderBottom:
                            i < rest.length - 1
                              ? `1px solid ${T.border.line}`
                              : "none",
                          background: "rgba(255,255,255,0.012)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "10px",
                            color: T.ink.faint,
                            width: "28px",
                            textAlign: "right",
                            flexShrink: 0,
                          }}
                        >
                          {entry.rank}
                        </span>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "rgba(127,223,255,0.08)",
                            border: "1px solid rgba(127,223,255,0.14)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            fontWeight: 600,
                            color: T.accent.aurora,
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {entry.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            getInitials(entry)
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 500,
                              color: T.ink.base,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getDisplayName(entry)}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: T.font.mono,
                              fontSize: "8px",
                              letterSpacing: ".10em",
                              textTransform: "uppercase",
                              color: TIER_COLORS[entry.tier] ?? T.ink.faint,
                            }}
                          >
                            {entry.tier}
                            {entry.country ? ` · ${entry.country}` : ""}
                          </p>
                        </div>
                        <span
                          style={{
                            fontFamily: T.font.serif,
                            fontSize: "18px",
                            fontWeight: 400,
                            letterSpacing: "-0.02em",
                            color: T.ink.base,
                            flexShrink: 0,
                          }}
                        >
                          {entry.periodPoints.toLocaleString()}
                          <span
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "7px",
                              letterSpacing: ".12em",
                              textTransform: "uppercase",
                              color: T.ink.faint,
                              marginLeft: "5px",
                            }}
                          >
                            pts
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Your standing */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "20px",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  marginBottom: "12px",
                }}
              >
                Your standing
              </p>
              {!session?.user ? (
                <div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: T.ink.dim,
                      marginBottom: "12px",
                    }}
                  >
                    Sign in to see your rank, tier, and progress.
                  </p>
                  <GlobalLink
                    href="/auth/signin"
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: `1px solid rgba(127,223,255,0.3)`,
                      background: "rgba(127,223,255,0.07)",
                      color: T.accent.aurora,
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                    }}
                  >
                    Sign in →
                  </GlobalLink>
                </div>
              ) : standing ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {[
                    {
                      label: "Global rank",
                      value:
                        standing.globalRank != null
                          ? `#${standing.globalRank}`
                          : "—",
                    },
                    {
                      label: "Tier",
                      value: `${standing.tier.name} (Level ${standing.tier.level})`,
                    },
                    {
                      label: "Total points",
                      value: standing.totalPoints.toLocaleString(),
                    },
                    {
                      label: "This month",
                      value: standing.pointsThisMonth.toLocaleString(),
                    },
                    {
                      label: "Streak",
                      value: `${standing.streak} day${standing.streak === 1 ? "" : "s"}`,
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: T.font.mono,
                          fontSize: "8px",
                          letterSpacing: ".14em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: T.font.serif,
                          fontSize: "18px",
                          fontWeight: 400,
                          letterSpacing: "-0.02em",
                          color: T.ink.base,
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                  {standing.tier.nextName && (
                    <div>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontFamily: T.font.mono,
                          fontSize: "8px",
                          letterSpacing: ".14em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                        }}
                      >
                        Progress to {standing.tier.nextName}
                      </p>
                      <div
                        style={{
                          height: "4px",
                          borderRadius: "2px",
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${standing.tier.progressPercent}%`,
                            background: T.accent.aurora,
                            borderRadius: "2px",
                            transition: "width 600ms",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontFamily: T.font.mono,
                          fontSize: "8px",
                          color: T.ink.faint,
                          textAlign: "right",
                        }}
                      >
                        {standing.tier.progressPercent}%
                      </p>
                    </div>
                  )}
                  {standing.suggestedAction && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        color: T.ink.faint,
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      {standing.suggestedAction}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: T.ink.faint }}>
                  Loading your standing…
                </p>
              )}
            </div>

            {/* How points work */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "20px",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  marginBottom: "12px",
                }}
              >
                How points work
              </p>
              {[
                { label: "New library approved", pts: "+50" },
                { label: "Major edit approved", pts: "+15" },
                { label: "Wiki translation", pts: "+15" },
                { label: "Minor edit approved", pts: "+5" },
                { label: "Hours verified", pts: "+5" },
                { label: "Status verified", pts: "+5" },
                { label: "Daily streak", pts: "+1" },
              ].map(({ label, pts }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    borderBottom: `1px solid ${T.border.line}`,
                  }}
                >
                  <span style={{ fontSize: "12px", color: T.ink.dim }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.accent.aurora,
                    }}
                  >
                    {pts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
