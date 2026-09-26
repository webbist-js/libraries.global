import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import {
  type LeaderboardEntry,
  getDisplayName,
  getInitials,
} from "@/lib/types/leaderboard"

const TIER_COLORS: Record<string, string> = {
  Reader: T.ink.dim,
  Indexer: T.ink.dim,
  Cartographer: T.accent.primary,
  Archivist: TYPE_TINT.national.fg,
  Scholar: T.accent.warn,
  Curator: T.accent.warn,
}

export function LeaderboardRows({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null

  return (
    <ol
      className="m-0 list-none overflow-hidden rounded-[20px] p-0"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      {entries.map((entry, i) => (
        <li
          key={entry.baUserId}
          style={
            i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
          }
        >
          <GlobalLink
            href={entry.username ? `/profile/${entry.username}` : "#"}
            className="flex items-center gap-3 px-4 py-3.5 no-underline transition-colors hover:bg-(--t-bg-surface) sm:gap-4 sm:px-6"
          >
            <span
              className="w-8 shrink-0 text-right text-[15px] font-semibold tabular-nums"
              style={{ color: T.ink.dim }}
            >
              {entry.rank}
            </span>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold"
              style={{ background: T.accent.chip, color: T.accent.primary }}
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
            <div className="min-w-0 flex-1">
              <p
                className="m-0 truncate text-[16px] font-semibold"
                style={{ color: T.ink.base }}
              >
                {getDisplayName(entry)}
              </p>
              <p
                className="m-0 truncate text-[14px] font-medium"
                style={{ color: TIER_COLORS[entry.tier] ?? T.ink.dim }}
              >
                {entry.tier}
                {entry.country ? (
                  <span style={{ color: T.ink.dim }}>
                    {` · ${entry.country}`}
                  </span>
                ) : null}
              </p>
            </div>
            <span className="shrink-0 whitespace-nowrap">
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "22px",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: T.ink.base,
                }}
              >
                {entry.periodPoints.toLocaleString()}
              </span>
              <span className="ml-1 text-[14px]" style={{ color: T.ink.dim }}>
                pts
              </span>
            </span>
          </GlobalLink>
        </li>
      ))}
    </ol>
  )
}
