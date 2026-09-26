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

const COLS_CLASS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
}

export function LeaderboardPodium({
  entries,
}: {
  entries: LeaderboardEntry[]
}) {
  if (entries.length === 0) return null

  return (
    <ol
      className={`m-0 mb-6 grid list-none grid-cols-1 gap-4 p-0 ${COLS_CLASS[entries.length] ?? "sm:grid-cols-3"}`}
    >
      {entries.map((entry) => {
        const isFirst = entry.rank === 1

        return (
          <li key={entry.baUserId} className="min-w-0">
            <GlobalLink
              href={entry.username ? `/profile/${entry.username}` : "#"}
              className="block h-full rounded-[20px] px-5 py-6 text-center no-underline transition-[box-shadow,border-color] hover:border-(--t-border-hi) hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"
              style={{
                border: `1px solid ${isFirst ? T.border.hi : T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <span
                className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold"
                style={
                  isFirst
                    ? { background: T.accent.chip, color: T.accent.primary }
                    : { background: T.bg.muted, color: T.ink.dim }
                }
              >
                Rank {entry.rank}
              </span>
              <div
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold"
                style={{ background: T.accent.chip, color: T.accent.primary }}
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
                className="m-0 mb-1 break-words"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "20px",
                  fontWeight: 500,
                  lineHeight: 1.25,
                  color: T.ink.base,
                }}
              >
                {getDisplayName(entry)}
              </p>
              <p
                className="m-0 mb-3 text-[14px] font-medium"
                style={{ color: TIER_COLORS[entry.tier] ?? T.ink.dim }}
              >
                {entry.tier}
                {entry.country ? (
                  <span style={{ color: T.ink.dim }}>
                    {` · ${entry.country}`}
                  </span>
                ) : null}
              </p>
              <p className="m-0">
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "32px",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    color: T.ink.base,
                  }}
                >
                  {entry.periodPoints.toLocaleString()}
                </span>
                <span
                  className="ml-1.5 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  pts
                </span>
              </p>
            </GlobalLink>
          </li>
        )
      })}
    </ol>
  )
}
