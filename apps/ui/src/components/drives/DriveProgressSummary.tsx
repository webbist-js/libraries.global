import { useTranslations } from "next-intl"
import { useId } from "react"

import { T } from "@/lib/design-tokens"
import type { DriveNumbers } from "@/lib/drives/drive-view"
import type { DriveProgressLogEntry, DriveUnit } from "@/lib/drives/types"

import { unitNoun } from "./focus-meta"
import { publishedThisWeek } from "./progress-summary"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** Compact hero summary; uses published tallies, keeping pending work separate. */
export function DriveProgressSummary({
  progress,
  unit,
  gapPhrase,
  goalPercent,
  helpers,
  log,
  finished = false,
}: {
  readonly progress: Pick<DriveNumbers, "total" | "done" | "inReview">
  readonly unit: DriveUnit
  readonly gapPhrase: string
  readonly goalPercent: number
  readonly helpers: number | null
  readonly log?: readonly DriveProgressLogEntry[] | null
  readonly finished?: boolean
}) {
  const t = useTranslations("drivePage")
  const textId = useId()
  const total = Math.max(0, progress.total)
  const done = Math.max(0, Math.min(progress.done, total))
  const review = Math.max(0, Math.min(progress.inReview, total - done))
  const todo = total - done - review
  const goal = Math.max(0, Math.min(100, goalPercent))
  const goalCount = Math.ceil((total * goal) / 100)
  const remaining = Math.max(0, goalCount - done)
  const percent = total ? Math.round((done / total) * 1000) / 10 : 0
  const change = finished ? null : publishedThisWeek(log, done)
  const width = (n: number) => `${total ? (n / total) * 100 : 0}%`
  const label = `${fmt(done)} of ${fmt(total)} ${unitNoun(unit, total)} ${gapPhrase}, ${fmt(review)} in review`

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
        <p id={textId} className="m-0 text-[16px] text-(--t-ink-dim)">
          <strong
            className="mr-2.5 text-[52px] leading-none font-medium text-(--t-ink-base)"
            style={{ fontFamily: T.font.serif }}
          >
            {fmt(done)}
          </strong>
          {t("coverage", {
            total: fmt(total),
            unit: unitNoun(unit, total),
            phrase: gapPhrase,
          })}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-(--t-ink-dim)">
          <span>
            <strong className="text-(--t-ink-base)">{percent}%</strong>{" "}
            {t("done")}
          </span>
          {helpers != null ? (
            <span>
              {t.rich(finished ? "helpersFinished" : "helpers", {
                count: helpers,
                countLabel: (chunks) => (
                  <strong className="text-(--t-ink-base)">{chunks}</strong>
                ),
              })}
            </span>
          ) : null}
          {change != null ? (
            <span>
              <strong className="text-(--t-ink-base)">
                {change > 0 ? "+" : ""}
                {fmt(change)}
              </strong>{" "}
              {t("thisWeek")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative pb-7">
        <span
          role="img"
          aria-label={label}
          aria-describedby={textId}
          className="flex h-3.5 overflow-hidden rounded-full bg-(--t-divider)"
        >
          <span
            data-segment="done"
            className="h-full bg-[#315f3b]"
            style={{ width: width(done) }}
          />
          <span
            data-segment="in-review"
            className="h-full bg-[#a0b99f]"
            style={{
              width: width(review),
              boxShadow: review > 0 ? "inset 1px 0 white" : undefined,
            }}
          />
        </span>
        <span
          aria-hidden
          className="absolute -top-1 h-6 rounded-full border-l-2 border-(--t-ink-base)"
          style={{ left: `${goal}%` }}
        />
        <span
          className="absolute top-6 text-[13px] font-bold whitespace-nowrap text-(--t-ink-base)"
          style={{
            left: `${goal}%`,
            transform:
              goal < 10
                ? "none"
                : goal > 90
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          {t("goal", { percent: goal, count: fmt(goalCount) })}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[14px] text-(--t-ink-dim)">
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
          {[
            [t("published"), done, "#315f3b"],
            [t("inReview"), review, "#a0b99f"],
            [t("todo"), todo, T.border.divider],
          ].map(([name, n, color]) => (
            <li key={name} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{
                  background: String(color),
                  boxShadow:
                    color === T.border.divider
                      ? `inset 0 0 0 1px ${T.border.hi}`
                      : undefined,
                }}
              />
              {name} {fmt(Number(n))}
            </li>
          ))}
        </ul>
        <span>
          {total === 0
            ? t("noTarget")
            : remaining
              ? t("remaining", { count: remaining })
              : t("goalReached")}
        </span>
      </div>
    </div>
  )
}
