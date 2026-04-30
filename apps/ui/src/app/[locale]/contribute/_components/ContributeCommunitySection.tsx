import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type LeaderboardEntry,
  getDisplayName,
  getInitials,
} from "@/lib/types/leaderboard"

export type { LeaderboardEntry }

const TIER_COLORS: Record<string, string> = {
  Reader: T.ink.faint,
  Indexer: T.ink.dim,
  Cartographer: T.accent.aurora,
  Archivist: T.accent.violet,
  Scholar: T.accent.gold,
  Curator: T.accent.gold,
}

async function fetchTopFive(): Promise<LeaderboardEntry[]> {
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${strapi}/api/rewards/leaderboard?period=month&limit=5`,
      {
        next: { revalidate: 3600 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }

    return json.data ?? []
  } catch {
    return []
  }
}

export async function ContributeCommunitySection() {
  const entries = await fetchTopFive()

  return (
    <section
      style={{
        borderTop: `1px solid ${T.border.line}`,
        padding: "60px 0",
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 md:px-10">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "32px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".20em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                marginBottom: "8px",
              }}
            >
              Community
            </p>
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                lineHeight: 0.94,
                margin: 0,
              }}
            >
              The community.
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: T.ink.faint,
                marginTop: "10px",
                maxWidth: "36ch",
              }}
            >
              Contributors who shape the atlas, ranked by points this month.
            </p>
          </div>

          <GlobalLink
            href="/contribute/community"
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            See full leaderboard →
          </GlobalLink>
        </div>

        {/* Leaderboard rows */}
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
            No contributions yet this month — be the first.
          </p>
        ) : (
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {entries.map((entry, i) => (
              <div
                key={entry.baUserId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "14px 20px",
                  borderBottom:
                    i < entries.length - 1
                      ? `1px solid ${T.border.line}`
                      : "none",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: i === 0 ? T.accent.gold : T.ink.faint,
                    letterSpacing: ".08em",
                    width: "24px",
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {entry.rank}
                </span>

                {/* Avatar */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "rgba(127,223,255,0.10)",
                    border: "1px solid rgba(127,223,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.font.mono,
                    fontSize: "10px",
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
                      alt={getDisplayName(entry)}
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

                {/* Name + meta */}
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
                      fontSize: "9px",
                      letterSpacing: ".10em",
                      textTransform: "uppercase",
                      color: TIER_COLORS[entry.tier] ?? T.ink.faint,
                    }}
                  >
                    {entry.tier}
                    {entry.country ? ` · ${entry.country}` : ""}
                  </p>
                </div>

                {/* Points */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: T.font.serif,
                      fontSize: "20px",
                      fontWeight: 400,
                      letterSpacing: "-0.02em",
                      color: T.ink.base,
                    }}
                  >
                    {entry.periodPoints.toLocaleString()}
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: T.font.mono,
                      fontSize: "8px",
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                    }}
                  >
                    pts · month
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Showing top {entries.length} · Global · This month
          </span>
          <GlobalLink
            href="/contribute/community"
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
            }}
          >
            Full leaderboard →
          </GlobalLink>
        </div>
      </div>
    </section>
  )
}
