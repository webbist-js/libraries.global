"use client"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

/**
 * A bar per day with a "Show as a table" toggle. `ghost` draws the sample
 * on a plan gate: pale bars, no toggle.
 */
export function BarSeries({
  title,
  points,
  heading: Heading = "h2",
  ghost = false,
}: {
  readonly title: string
  readonly points: { date: string; value: number }[]
  readonly highlightLast?: boolean
  /** The heading element for the title: `h2` under a page, `h3` in a card. */
  readonly heading?: "h2" | "h3" | "p"
  readonly ghost?: boolean
}) {
  const [table, setTable] = useState(false)
  const max = Math.max(1, ...points.map((p) => p.value))

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <Heading
          className="m-0 text-xl"
          style={{
            fontFamily: T.font.serif,
            color: ghost ? T.ink.dim : T.ink.base,
          }}
        >
          {title}
        </Heading>
        {ghost ? null : (
          <button
            type="button"
            onClick={() => setTable((value) => !value)}
            className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold hover:bg-(--t-bg-surface)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {table ? "Show as bars" : "Show as a table"}
          </button>
        )}
      </div>
      {table && !ghost ? (
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Views</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row" className="font-normal">
                  {p.date}
                </th>
                <td className="tabular-nums">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="mt-3 flex h-32 items-end gap-1"
          role="img"
          aria-label={`${title}: ${points.map((p) => `${p.date}: ${p.value}`).join(", ")}`}
        >
          {points.map((p) => (
            <div
              key={p.date}
              className="flex-1 rounded-t"
              style={{
                height: `${(p.value / max) * 100}%`,
                background: ghost ? T.accent.chip : T.accent.primary,
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
