// Changes per month as an inline SVG bar chart (no chart library). The
// numbers are repeated in the aria-label and in a visually hidden table.

import { T } from "@/lib/design-tokens"
import type { LibraryHistoryStats } from "@/lib/strapi-api/content/server"

import { monthName } from "./change-history.helpers"

type Month = LibraryHistoryStats["months"][number]

const BAR = 36
const GAP = 4
const CHART_H = 64
const TOP = 12 // room for the "Checked" dots
const EMPTY_H = 3 // a stub bar so quiet months still read as months

/** "Changes per month, last 24 months: 3 in Oct 2025, 1 in Jan 2026." */
export function histogramLabel(months: readonly Month[]): string {
  const busy = months
    .filter((m) => m.batches > 0)
    .map((m) => `${m.batches} in ${monthName(m.month)}`)

  return `Changes per month, last ${months.length} months: ${
    busy.length ? busy.join(", ") : "none"
  }.`
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
  const latest = months.reduce((at, m, i) => (m.batches > 0 ? i : at), -1)

  return (
    <figure className="m-0 min-w-0">
      <svg
        role="img"
        aria-label={histogramLabel(months)}
        viewBox={`0 0 ${Math.max(width, 1)} ${baseline}`}
        className="block h-auto w-full"
      >
        {months.map((m, i) => {
          const h = m.batches
            ? Math.max(EMPTY_H * 2, Math.round((m.batches / max) * CHART_H))
            : EMPTY_H
          const x = i * (BAR + GAP)

          return (
            <g key={m.month}>
              <rect
                data-month={m.month}
                x={x}
                y={baseline - h}
                width={BAR}
                height={h}
                rx={m.batches ? 3 : 1.5}
                fill={T.accent.primary}
                fillOpacity={i === latest ? 1 : 0.55}
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
            </g>
          )
        })}
      </svg>

      <figcaption
        className="mt-2 flex items-center justify-between gap-4 text-[14px]"
        style={{ color: T.ink.dim }}
      >
        <span data-axis>{months[0] ? monthName(months[0].month) : null}</span>
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
        <span data-axis>
          {months.at(-1) ? monthName(months.at(-1)!.month) : null}
        </span>
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
