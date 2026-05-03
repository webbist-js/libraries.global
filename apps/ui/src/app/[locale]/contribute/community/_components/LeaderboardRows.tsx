import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type LeaderboardEntry,
  getDisplayName,
  getInitials,
} from "@/lib/types/leaderboard"

const TIER_COLORS: Record<string, string> = {
  Reader: T.ink.faint,
  Indexer: T.ink.dim,
  Cartographer: T.accent.aurora,
  Archivist: T.accent.violet,
  Scholar: T.accent.gold,
  Curator: T.accent.gold,
}

export function LeaderboardRows({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {entries.map((entry, i) => (
        <GlobalLink
          key={entry.baUserId}
          href={entry.username ? `/profile/${entry.username}` : "#"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "12px 20px",
            borderBottom:
              i < entries.length - 1 ? `1px solid ${T.border.line}` : "none",
            background: T.bg.surface,
            textDecoration: "none",
            transition: "background 120ms",
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
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                fontSize: "10px",
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
        </GlobalLink>
      ))}
    </div>
  )
}
