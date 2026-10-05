import {
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

/**
 * Today / This week / This month / All time, as pill links in a white
 * track. Each is a `?period=` URL, so a period is shareable and works
 * without JavaScript; `scroll={false}` keeps the reader's place.
 */
export function LeaderboardPeriodNav({
  period,
}: {
  readonly period: LeaderboardPeriod
}) {
  return (
    <nav
      aria-label="Leaderboard period"
      className="flex w-full gap-[2px] rounded-full p-[4px] sm:w-auto"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      {LEADERBOARD_PERIODS.map(({ key, label }) => {
        const active = key === period

        return (
          <Link
            key={key}
            href={`/community/leaderboard?period=${key}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-[10px] text-[15px] font-semibold whitespace-nowrap no-underline sm:flex-none sm:px-[16px] ${
              active ? "text-white" : "hover:bg-(--t-bg-muted-2)"
            }`}
            style={active ? { background: T.ink.base } : { color: T.ink.base }}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
