import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"

import { fmt } from "./leaderboard-ui"

/**
 * For a signed-in viewer who isn't on the board: not ranked yet for the
 * period, or ranked below the rows shown. Either way, a way to start.
 */
export function ViewerRankCard({
  initials,
  rank,
  periodPhrase,
}: {
  /** The viewer's initials, for the avatar. */
  readonly initials: string
  /** The viewer's rank for the period; null when they have none yet. */
  readonly rank: number | null
  /** The period as it reads in a sentence: "this month", "ever". */
  readonly periodPhrase: string
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-[14px] rounded-[20px] px-[18px] py-[14px]"
      style={{ background: T.bg.deep, border: `1px dashed ${T.border.hi}` }}
    >
      <span
        aria-hidden="true"
        className="flex size-[36px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{
          background: TYPE_TINT.national.bg,
          color: TYPE_TINT.national.fg,
        }}
      >
        {initials}
      </span>
      <p
        className="m-0 text-[16px] leading-normal"
        style={{ flex: "1 1 220px", color: T.ink.base }}
      >
        {rank == null ? (
          <>
            <strong>You’re not ranked yet.</strong>{" "}
            <span style={{ color: T.ink.dim }}>
              Rankings start with your first approved change.
            </span>
          </>
        ) : (
          <strong>{`You’re #${fmt(rank)} ${periodPhrase}.`}</strong>
        )}
      </p>
      <GlobalLink
        href="/contribute/index"
        className="inline-flex min-h-[44px] items-center rounded-full bg-(--t-accent-primary) px-[18px] text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
      >
        Make a change
      </GlobalLink>
    </div>
  )
}
