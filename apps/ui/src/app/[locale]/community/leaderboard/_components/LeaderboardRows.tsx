import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  entryPlace,
  getDisplayName,
  getInitials,
  type LeaderboardEntry,
} from "@/lib/types/leaderboard"

import { fmt, rankTint } from "./leaderboard-ui"

const GRID = "grid grid-cols-[32px_minmax(0,1fr)_auto] gap-[12px] px-[18px]"

/** The viewer's row: a faint indigo wash with no token of its own. */
const YOU_ROW_BG = "#F6F5FD"

function Row({
  entry,
  you,
}: {
  readonly entry: LeaderboardEntry
  readonly you: boolean
}) {
  const tint = rankTint(entry.rank)
  const name = getDisplayName(entry)
  const place = entryPlace(entry)

  return (
    <li
      className={`${GRID} -mt-px items-center py-[12px]`}
      style={{
        borderTop: `1px solid ${T.border.divider}`,
        background: you ? YOU_ROW_BG : T.bg.deep,
      }}
    >
      <span className="text-base font-bold" style={{ color: T.ink.dim }}>
        {entry.rank}
      </span>
      <span className="flex min-w-0 items-center gap-[12px]">
        <span
          aria-hidden="true"
          className="flex size-[36px] shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: tint.bg, color: tint.fg }}
        >
          {getInitials(entry)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-[8px]">
            {entry.username ? (
              <GlobalLink
                href={`/profile/${entry.username}`}
                className="min-w-0 text-base font-bold wrap-break-word no-underline hover:underline"
                style={{ color: T.ink.base }}
              >
                {name}
              </GlobalLink>
            ) : (
              <span
                className="min-w-0 text-base font-bold wrap-break-word"
                style={{ color: T.ink.base }}
              >
                {name}
              </span>
            )}
            {you ? (
              <span
                className="rounded-full px-[8px] py-[2px] text-xs font-bold text-white"
                style={{ background: T.accent.primary }}
              >
                You
              </span>
            ) : null}
          </span>
          <span className="text-sm" style={{ color: T.ink.dim }}>
            {place ? `${entry.tier} · ${place}` : entry.tier}
          </span>
        </span>
      </span>
      <span className="flex flex-col items-end gap-[2px] text-right">
        <span
          className="leading-none"
          style={{
            fontFamily: T.font.sans,
            fontSize: 24,
            color: T.ink.base,
          }}
        >
          <span className="sr-only">Points: </span>
          {fmt(entry.periodPoints)}
        </span>
        <span
          className="text-sm whitespace-nowrap"
          style={{ color: T.ink.dim }}
        >
          {fmt(entry.approvedCount)} approved
          {entry.acceptanceRate == null ? "" : ` · ${entry.acceptanceRate}%`}
        </span>
      </span>
    </li>
  )
}

/**
 * Rank 4 and below, under the podium. Renders nothing when there are none.
 * The viewer's row (`youRank`) gets a "You" chip and a tinted background.
 */
export function LeaderboardRows({
  entries,
  youRank = null,
}: {
  readonly entries: readonly LeaderboardEntry[]
  /** The viewer's rank for this period, from their standing. */
  readonly youRank?: number | null
}) {
  if (entries.length === 0) return null

  return (
    <div
      className="overflow-hidden rounded-3xl"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div
        aria-hidden="true"
        className={`${GRID} py-[12px] text-sm font-bold`}
        style={{
          background: T.bg.surface,
          borderBottom: `1px solid ${T.border.divider}`,
          color: T.ink.dim,
        }}
      >
        <span>#</span>
        <span>Contributor</span>
        <span className="text-right">Points</span>
      </div>
      <ol className="m-0 list-none p-0" start={entries[0]?.rank}>
        {entries.map((entry) => (
          <Row
            key={entry.rank}
            entry={entry}
            you={youRank != null && entry.rank === youRank}
          />
        ))}
      </ol>
    </div>
  )
}
