// Changes per month as an inline SVG bar chart (no chart library). The
// numbers are repeated in the aria-label and in a visually hidden table.

import { T } from "@/lib/design-tokens"
import type { LibraryHistoryStats } from "@/lib/strapi-api/content/server"

import { monthName } from "./change-history.helpers"

type Month = LibraryHistoryStats["months"][number]

const BAR = 14
const GAP = 6
const CHART_H = 96
const TOP = 12 // room for the "Checked" dots
const AXIS_H = 18

/** "Changes per month, last 24 months: 3 in Oct 2025, 1 in Jan 2026." */
export function histogramLabel(months: readonly Month[]): string {
  const busy = months
    .filter((m) => m.batches > 0)
    .map((m) => `${m.batches} in ${monthName(m.month)}`)

  return `Changes per month, last ${months.length} months: ${
    busy.length ? busy.join(", ") : "none"
  }.`
}

/** "Oct ’25": the short axis label. */
function axisLabel(month: string): string {
  const [y, m] = month.split("-")
  const name = monthName(month).split(" ")[0] ?? month

  return y && m ? `${name} ’${y.slice(2)}` : month
}

export function ChangeHistogram({
  months,
  verificationEvents,
}: {
  readonly months: readonly Month[]
  readonly verificationEvents: readonly string[]
}) {
  const checked = new Set(verificationEvents)
  const max = Math.max(1, ...months.map((m) => m.batches))
  const width = months.length * (BAR + GAP) - GAP
  const baseline = TOP + CHART_H
  const anyChecked = months.some((m) => checked.has(m.month))

  return (
    <figure className="m-0 min-w-0">
      <svg
        role="img"
        aria-label={histogramLabel(months)}
        viewBox={`0 0 ${Math.max(width, 1)} ${baseline + AXIS_H}`}
        className="block h-auto w-full max-w-[560px]"
      >
        {months.map((m, i) => {
          const h = Math.round((m.batches / max) * CHART_H)
          const x = i * (BAR + GAP)

          return (
            <g key={m.month}>
              <rect
                data-month={m.month}
                x={x}
                y={baseline - h}
                width={BAR}
                height={h}
                rx={2}
                fill={T.accent.primary}
              />
              {checked.has(m.month) ? (
                <circle
                  data-checked={m.month}
                  cx={x + BAR / 2}
                  cy={Math.max(4, baseline - h - 6)}
                  r={3}
                  fill={T.accent.ok}
                />
              ) : null}
              {i % 6 === 0 ? (
                <text
                  data-axis
                  x={x}
                  y={baseline + AXIS_H - 3}
                  fontSize={10}
                  fill={T.ink.dim}
                  style={{ fontFamily: T.font.sans }}
                >
                  {axisLabel(m.month)}
                </text>
              ) : null}
            </g>
          )
        })}
        <line
          x1={0}
          x2={Math.max(width, 1)}
          y1={baseline + 0.5}
          y2={baseline + 0.5}
          stroke={T.border.line}
          strokeWidth={1}
        />
      </svg>

      <figcaption
        className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]"
        style={{ color: T.ink.dim }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-[2px]"
            style={{ background: T.accent.primary }}
          />
          Changes per month
        </span>
        {anyChecked ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ background: T.accent.ok }}
            />
            Checked
          </span>
        ) : null}
      </figcaption>

      <table className="sr-only">
        <caption>Changes per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Changes</th>
            <th scope="col">Fields changed</th>
            <th scope="col">Contributors</th>
            <th scope="col">Checked that month</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthName(m.month)}</th>
              <td>{m.batches}</td>
              <td>{m.fields}</td>
              <td>{m.contributors}</td>
              <td>{checked.has(m.month) ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
