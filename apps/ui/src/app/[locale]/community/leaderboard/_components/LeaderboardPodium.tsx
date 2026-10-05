import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  getDisplayName,
  getInitials,
  type LeaderboardEntry,
} from "@/lib/types/leaderboard"

import { fmt, rankTint } from "./leaderboard-ui"

/**
 * From `sm` up the podium reads 2, 1, 3. The DOM stays in rank order, so the
 * cards stack 1, 2, 3 on a phone and a screen reader hears them in order.
 */
const SM_ORDER: Record<number, string> = {
  1: "sm:order-2 sm:min-h-[290px]",
  2: "sm:order-1 sm:min-h-[250px]",
  3: "sm:order-3 sm:min-h-[250px]",
}

const CARD_CLASS =
  "box-border flex min-w-0 flex-col items-center justify-end gap-[8px] rounded-3xl px-[12px] py-[20px] text-center"

function RankChip({ rank }: { readonly rank: number }) {
  const first = rank === 1

  return (
    <span
      className={`rounded-full px-[12px] py-[4px] text-[13px] font-bold ${first ? "text-white" : ""}`}
      style={
        first
          ? { background: T.accent.primary }
          : { background: T.accent.chip, color: T.accent.primaryHover }
      }
    >
      Rank {rank}
    </span>
  )
}

function OpenSpot({
  rank,
  periodPhrase,
}: {
  readonly rank: number
  readonly periodPhrase: string
}) {
  return (
    <li
      className={`${CARD_CLASS} ${SM_ORDER[rank]}`}
      style={{
        background: T.bg.surface,
        border: `1px dashed ${T.border.hi}`,
      }}
    >
      <RankChip rank={rank} />
      <span
        aria-hidden="true"
        className="box-border flex size-[56px] items-center justify-center rounded-full"
        style={{ border: `2px dashed ${T.border.hi}`, color: T.ink.dim }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <strong
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: 22,
          color: T.ink.base,
        }}
      >
        Open spot
      </strong>
      <span
        className="max-w-[24ch] text-[14px] leading-[1.45]"
        style={{ color: T.ink.dim }}
      >
        One approved change {periodPhrase} puts you here.
      </span>
    </li>
  )
}

function PodiumCard({
  entry,
  rank,
}: {
  readonly entry: LeaderboardEntry
  readonly rank: number
}) {
  const first = rank === 1
  const tint = rankTint(rank)
  const name = getDisplayName(entry)
  const avatar = first ? 72 : 60

  return (
    <li
      className={`${CARD_CLASS} ${SM_ORDER[rank]}`}
      style={{
        background: T.bg.deep,
        border: first
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
      }}
    >
      <RankChip rank={rank} />
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: avatar,
          height: avatar,
          background: tint.bg,
          color: tint.fg,
          fontFamily: T.font.serif,
          fontSize: 22,
        }}
      >
        {getInitials(entry)}
      </span>
      {entry.username ? (
        <GlobalLink
          href={`/profile/${entry.username}`}
          className="wrap-break-word no-underline hover:underline"
          style={{
            fontFamily: T.font.serif,
            fontSize: 24,
            lineHeight: 1.1,
            color: T.ink.base,
          }}
        >
          {name}
        </GlobalLink>
      ) : (
        <span
          className="wrap-break-word"
          style={{
            fontFamily: T.font.serif,
            fontSize: 24,
            lineHeight: 1.1,
            color: T.ink.base,
          }}
        >
          {name}
        </span>
      )}
      <span className="text-[14px]" style={{ color: T.ink.dim }}>
        {entry.tier}
      </span>
      <span className="text-[15px]" style={{ color: T.ink.dim }}>
        <strong
          style={{
            fontFamily: T.font.serif,
            fontSize: 32,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {fmt(entry.periodPoints)}
        </strong>{" "}
        pts
      </span>
      <span
        className="flex flex-col gap-px text-[14px]"
        style={{ color: T.ink.dim }}
      >
        <span>{fmt(entry.approvedCount)} approved</span>
        {entry.acceptanceRate == null ? null : (
          <span>{entry.acceptanceRate}% accepted</span>
        )}
      </span>
    </li>
  )
}

/**
 * The period's top three. An empty place is an "Open spot" card, so the
 * podium always shows three.
 */
export function LeaderboardPodium({
  entries,
  periodPhrase,
}: {
  /** The leaderboard in rank order; only the first three are used. */
  readonly entries: readonly LeaderboardEntry[]
  /** The period as it reads in a sentence: "this month", "ever". */
  readonly periodPhrase: string
}) {
  return (
    <ol
      aria-label="Top three"
      className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-3 sm:items-end"
    >
      {[1, 2, 3].map((rank) => {
        const entry = entries[rank - 1]

        return entry ? (
          <PodiumCard key={rank} entry={entry} rank={rank} />
        ) : (
          <OpenSpot key={rank} rank={rank} periodPhrase={periodPhrase} />
        )
      })}
    </ol>
  )
}
