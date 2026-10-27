import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import {
  getDisplayName,
  getInitials,
  type LeaderboardEntry,
} from "@/lib/types/leaderboard"

/** Avatar tints by position, as in the mockup. */
const TINTS = [TYPE_TINT.national, TYPE_TINT.academic, TYPE_TINT.public]

const ROW_STYLE = {
  borderTop: `1px solid ${T.border.divider}`,
  padding: "9px 0",
}

/**
 * This month's top three contributors, for the Noticeboard rail. An empty
 * place reads "Open spot", so the card always shows three rows.
 */
export function TopThisMonthCard({
  entries,
}: {
  readonly entries: readonly LeaderboardEntry[]
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section
      aria-labelledby="top-month-heading"
      className="flex flex-col gap-1.5"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="top-month-heading"
          className="type-panel-title m-0"
          style={{ color: T.ink.base }}
        >
          Top this month
        </h2>
        <GlobalLink
          href="/community/leaderboard"
          className="text-base font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          {tUi("leaderboard")}
        </GlobalLink>
      </div>
      <ol className="m-0 list-none p-0">
        {[0, 1, 2].map((i) => {
          const entry = entries[i]

          if (!entry) {
            return (
              <li
                key={`open-${i}`}
                className="flex items-center gap-2.5"
                style={{ ...ROW_STYLE, color: T.ink.dim }}
              >
                <span className="w-5 text-base font-bold">{i + 1}</span>
                <span
                  aria-hidden="true"
                  className="box-border size-8 shrink-0 rounded-full"
                  style={{ border: `2px dashed ${T.border.hi}` }}
                />
                <span className="flex-1 text-base">Open spot</span>
              </li>
            )
          }

          const tint = TINTS[i] ?? TYPE_TINT.neutral
          const name = getDisplayName(entry)

          return (
            <li
              key={entry.username ?? `rank-${entry.rank}-${i}`}
              className="flex items-center gap-2.5"
              style={ROW_STYLE}
            >
              <span
                className="w-5 text-base font-bold"
                style={{ color: T.ink.dim }}
              >
                {entry.rank}
              </span>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: tint.bg, color: tint.fg }}
              >
                {getInitials(entry)}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold">
                {entry.username ? (
                  <GlobalLink
                    href={`/profile/${entry.username}`}
                    className="no-underline hover:underline"
                    style={{ color: T.ink.base }}
                  >
                    {name}
                  </GlobalLink>
                ) : (
                  <span style={{ color: T.ink.base }}>{name}</span>
                )}
              </span>
              <span
                className="shrink-0 text-sm whitespace-nowrap"
                style={{ color: T.ink.dim }}
              >
                {entry.periodPoints.toLocaleString("en-GB")} pts
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
