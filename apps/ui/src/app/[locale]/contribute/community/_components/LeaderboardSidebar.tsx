import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

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

const POINT_ACTIONS = [
  { label: "New library approved", pts: "+50" },
  { label: "Major edit approved", pts: "+15" },
  { label: "Wiki translation", pts: "+15" },
  { label: "Minor edit approved", pts: "+5" },
  { label: "Hours verified", pts: "+5" },
  { label: "Status verified", pts: "+5" },
  { label: "Daily streak", pts: "+1" },
]

export function LeaderboardSidebar({
  isSignedIn,
  standing,
}: {
  isSignedIn: boolean
  standing: Standing | null
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Your standing */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "20px",
          background: T.bg.surface,
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
        {!isSignedIn ? (
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
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {[
              {
                label: "Global rank",
                value:
                  standing.globalRank != null ? `#${standing.globalRank}` : "—",
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
                    fontSize: "10px",
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
                    fontSize: "10px",
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
                    background: T.border.line,
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
                    fontSize: "10px",
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
          background: T.bg.surface,
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
        {POINT_ACTIONS.map(({ label, pts }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: `1px solid ${T.border.line}`,
            }}
          >
            <span style={{ fontSize: "12px", color: T.ink.dim }}>{label}</span>
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
  )
}
