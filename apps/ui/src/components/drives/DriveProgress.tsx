import { useId } from "react"

import { T } from "@/lib/design-tokens"
import type { DriveNumbers } from "@/lib/drives/drive-view"
import type { DriveProgressLogEntry, DriveUnit } from "@/lib/drives/types"

import { unitNoun } from "./focus-meta"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** A share of `total` as a CSS width, to one decimal place. */
const widthOf = (part: number, total: number) =>
  `${total > 0 ? Math.round((part / total) * 1000) / 10 : 0}%`

const SPARK_W = 240
const SPARK_H = 40

/**
 * Done work per logged day, as an SVG polyline scaled to the series' own
 * range (so a week's movement shows), with a caption naming the span.
 */
function Sparkline({
  log,
  unit,
  color,
}: {
  readonly log: readonly DriveProgressLogEntry[]
  readonly unit: DriveUnit
  readonly color: string
}) {
  const first = log[0]!
  const last = log.at(-1)!
  const values = log.map((e) => e.done)
  const low = Math.min(...values)
  const span = Math.max(1, Math.max(...values) - low)
  const step = SPARK_W / (log.length - 1)
  const points = log
    .map((e, i) => {
      const x = Math.round(i * step * 10) / 10
      const y =
        Math.round(
          (SPARK_H - 2 - ((e.done - low) / span) * (SPARK_H - 4)) * 10
        ) / 10

      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-1 pt-1">
      <svg
        role="img"
        aria-label={`Done over ${log.length} days: from ${fmt(first.done)} to ${fmt(last.done)} ${unitNoun(unit, last.done)}`}
        className="block h-10 w-full max-w-[240px] overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      >
        <line
          x1={0}
          x2={SPARK_W}
          y1={SPARK_H}
          y2={SPARK_H}
          stroke={T.border.line}
          strokeWidth={1}
        />
        <polyline
          fill="none"
          points={points}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="text-[13px]"
        style={{ color: T.ink.dim }}
      >
        Last {log.length} days: {fmt(first.done)} → {fmt(last.done)} done
      </span>
    </div>
  )
}

/**
 * A Drive's coverage (spec §5.3, §5.9): the done count in serif, a bar that
 * is a labelled `role="img"` ("142 of 251 branches have hours, 9 in review")
 * described by the visible count, with in-review work drawn as its own
 * hatched segment rather than taken off what's left. The goal shows only
 * when it isn't 100%; a sparkline follows when the log has two days or more.
 */
export function DriveProgress({
  progress,
  unit,
  gapPhrase,
  log,
  goalPercent = 100,
  meta,
  color = T.accent.ok,
}: {
  readonly progress: Pick<DriveNumbers, "total" | "done" | "inReview">
  readonly unit: DriveUnit
  /** What a done library has: "have hours" (`focus-meta`'s `gapPhraseOf`). */
  readonly gapPhrase: string
  /** The Drive's `progressLog`, oldest first. */
  readonly log?: readonly DriveProgressLogEntry[] | null
  readonly goalPercent?: number
  /** A line beside the count: "57% · 38 people helping". */
  readonly meta?: string
  /** The bar's colour: the Focus tint's ink. */
  readonly color?: string
}) {
  const textId = useId()
  const { total, done, inReview } = progress
  const noun = unitNoun(unit, total)
  const review = Math.max(0, Math.min(inReview, total - done))
  const label = `${fmt(done)} of ${fmt(total)} ${noun} ${gapPhrase}, ${fmt(inReview)} in review`
  const showGoal = goalPercent !== 100

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-1">
        <p id={textId} className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
          <strong
            style={{
              fontFamily: T.font.serif,
              fontSize: 32,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            {fmt(done)}
          </strong>{" "}
          <span>
            of {fmt(total)} {noun} done
          </span>
        </p>
        {meta ? (
          <p
            className="m-0 text-[15px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {meta}
          </p>
        ) : null}
      </div>

      <span
        role="img"
        aria-label={label}
        aria-describedby={textId}
        className="flex h-3 overflow-hidden rounded-full"
        style={{ background: T.border.divider }}
      >
        <span
          data-segment="done"
          className="block h-full"
          style={{ width: widthOf(done, total), background: color }}
        />
        <span
          data-segment="in-review"
          className="block h-full"
          style={{
            width: widthOf(review, total),
            background: `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`,
            opacity: 0.6,
          }}
        />
      </span>

      {inReview > 0 || showGoal ? (
        <ul
          className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[14px]"
          style={{ color: T.ink.dim }}
        >
          {inReview > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-[3px]"
                style={{
                  background: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 4px)`,
                  boxShadow: `inset 0 0 0 1px ${color}`,
                }}
              />
              {fmt(inReview)} in review
            </li>
          ) : null}
          {showGoal ? <li>Goal {goalPercent}%</li> : null}
        </ul>
      ) : null}

      {log && log.length >= 2 ? (
        <Sparkline log={log} unit={unit} color={color} />
      ) : null}
    </div>
  )
}
