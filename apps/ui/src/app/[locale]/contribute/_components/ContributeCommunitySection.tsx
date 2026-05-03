import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type LeaderboardEntry,
  getDisplayName,
  getInitials,
} from "@/lib/types/leaderboard"

export type { LeaderboardEntry }

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
        padding: "72px 0",
      }}
    >
      <div className="mx-auto w-full max-w-[1296px] px-6 md:px-10">
        {/* Header */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          style={{ marginBottom: "40px" }}
        >
          <div style={{ maxWidth: "52ch" }}>
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(2.4rem, 5vw, 4rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: T.ink.base,
                lineHeight: 1,
                margin: "0 0 16px",
              }}
            >
              The{" "}
              <em style={{ fontStyle: "italic", color: T.accent.aurora }}>
                community
              </em>
              .
            </h2>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.65,
                color: T.ink.dim,
                margin: 0,
              }}
            >
              Public recognition for the people doing the slow work. Points come
              from accepted contributions, image licensing, translations, and
              verifications.
            </p>
          </div>

          <div
            style={{
              flexShrink: 0,
              paddingTop: "6px",
              textAlign: "right",
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              Top {entries.length} · This month
            </span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_300px]">
          {/* Left: leaderboard table */}
          <div>
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {entries.length === 0 ? (
                <p
                  style={{
                    padding: "32px 24px",
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: T.ink.faint,
                    letterSpacing: ".10em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  No contributions yet this month — be the first.
                </p>
              ) : (
                entries.map((entry, i) => (
                  <div
                    key={entry.baUserId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "18px",
                      padding: "18px 24px",
                      borderBottom:
                        i < entries.length - 1
                          ? `1px solid ${T.border.line}`
                          : "none",
                      background: T.bg.surface,
                    }}
                  >
                    {/* Rank */}
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "13px",
                        fontWeight: 700,
                        color: i === 0 ? T.accent.gold : T.ink.dim,
                        width: "20px",
                        flexShrink: 0,
                        textAlign: "center",
                      }}
                    >
                      {entry.rank}
                    </span>

                    {/* Avatar */}
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "rgba(127,223,255,0.08)",
                        border: "1px solid rgba(127,223,255,0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: T.font.mono,
                        fontSize: "12px",
                        fontWeight: 700,
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "5px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: T.ink.base,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {getDisplayName(entry)}
                        </span>
                        {(entry.contributorRole ||
                          entry.tier ||
                          entry.country) && (
                          <span
                            style={{
                              fontFamily: T.font.mono,
                              fontSize: "9px",
                              letterSpacing: ".12em",
                              textTransform: "uppercase",
                              color: T.ink.dim,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              border: `1px solid ${T.border.line}`,
                              background: "rgba(255,255,255,0.04)",
                              flexShrink: 0,
                            }}
                          >
                            {[
                              entry.contributorRole ?? entry.tier,
                              entry.country,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".10em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                        }}
                      >
                        +{entry.periodPoints.toLocaleString()} pts · 30 days
                      </div>
                    </div>

                    {/* Points */}
                    <div
                      style={{
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.font.serif,
                          fontSize: "clamp(22px, 2.2vw, 28px)",
                          fontWeight: 400,
                          letterSpacing: "-0.02em",
                          color: T.ink.base,
                          lineHeight: 1,
                        }}
                      >
                        {entry.periodPoints.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          letterSpacing: ".14em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                          marginTop: "3px",
                        }}
                      >
                        Points
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer under table */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "14px",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
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
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  textDecoration: "none",
                }}
              >
                See full leaderboard →
              </GlobalLink>
            </div>
          </div>

          {/* Right: Where you stand */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "14px",
              padding: "24px",
              background: T.bg.surface,
            }}
          >
            <h3
              style={{
                fontFamily: T.font.serif,
                fontSize: "22px",
                fontWeight: 400,
                color: T.ink.base,
                margin: "0 0 20px",
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              Where you stand
            </h3>

            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: T.ink.faint,
                margin: "0 0 24px",
              }}
            >
              Earn points through accepted contributions, verified data, CC
              photo uploads, and wiki translations. Every action moves you up
              the board.
            </p>

            {/* Tier ladder (compact) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "24px",
              }}
            >
              {[
                { name: "Reader", min: 0, color: T.ink.faint },
                { name: "Indexer", min: 100, color: T.ink.dim },
                { name: "Cartographer", min: 500, color: T.accent.aurora },
                { name: "Archivist", min: 1500, color: T.accent.violet },
                { name: "Scholar", min: 4000, color: T.accent.gold },
                { name: "Curator", min: 9000, color: T.accent.gold },
              ].map((tier) => (
                <div
                  key={tier.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      letterSpacing: ".10em",
                      textTransform: "uppercase",
                      color: tier.color,
                    }}
                  >
                    {tier.name}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      color: T.ink.faint,
                      letterSpacing: ".06em",
                    }}
                  >
                    {tier.min.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <GlobalLink
                href="/contribute/community"
                style={{
                  display: "block",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: `1px solid ${T.border.line}`,
                  background: "rgba(255,255,255,0.04)",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.ink.base,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Open full board
              </GlobalLink>
              <GlobalLink
                href="/contribute"
                style={{
                  display: "block",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(127,223,255,0.35)",
                  background: "rgba(127,223,255,0.10)",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Start contributing
              </GlobalLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
