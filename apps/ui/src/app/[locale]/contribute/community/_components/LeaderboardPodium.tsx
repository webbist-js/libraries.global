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

export function LeaderboardPodium({
  entries,
}: {
  entries: LeaderboardEntry[]
}) {
  if (entries.length === 0) return null

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${entries.length}, 1fr)`,
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      {entries.map((entry) => (
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
              color: entry.rank === 1 ? T.accent.gold : T.ink.faint,
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
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
  )
}
