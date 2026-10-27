"use client"

import { useId, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/styles"

/** Shared daily bar chart with a keyboard-accessible table alternative. */
export function BarSeries({
  title,
  points,
  heading: Heading = "h2",
  ghost = false,
  highlightLast = false,
  valueLabel = "Views",
  locale = "en",
  dataTable,
  emptyMessage,
  endLabel,
  compact = false,
}: {
  readonly title: string
  readonly points: { date: string; value: number }[]
  readonly highlightLast?: boolean
  readonly heading?: "h2" | "h3" | "p"
  readonly ghost?: boolean
  readonly valueLabel?: string
  readonly locale?: string
  readonly dataTable?: ReactNode
  readonly emptyMessage?: string
  readonly endLabel?: string
  readonly compact?: boolean
}) {
  const [table, setTable] = useState(false)
  const id = useId()
  const max = Math.max(1, ...points.map((p) => p.value))
  const empty = !points.some((point) => point.value > 0)
  const number = new Intl.NumberFormat(locale)
  const date = (value: string) => {
    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(parsed)
  }

  return (
    <section className="min-w-0" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Heading
          className={`type-panel-title ${cn("m-0", ghost ? "text-(--t-ink-dim)" : "text-(--t-ink-base)")}`}
        >
          {title}
        </Heading>
        {!ghost ? (
          <Button
            type="button"
            variant="link"
            className="min-h-11 px-0 text-sm text-(--t-accent-primary) underline underline-offset-4"
            onClick={() => setTable((value) => !value)}
            aria-expanded={table}
            aria-controls={id}
          >
            {table ? "Show chart" : "Show daily table"}
          </Button>
        ) : null}
      </div>
      <div id={id}>
        {table && !ghost ? (
          (dataTable ?? (
            <div
              tabIndex={0}
              role="region"
              aria-label={title + " data"}
              className="mt-3 overflow-x-auto rounded-2xl border border-(--t-border-line)"
            >
              <table className="w-full text-left text-sm tabular-nums">
                <caption className="sr-only">{title}</caption>
                <thead className="bg-(--t-bg-surface)">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      {valueLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr
                      key={p.date}
                      className="border-t border-(--t-border-line)"
                    >
                      <th scope="row" className="px-4 py-3 font-normal">
                        {date(p.date)}
                      </th>
                      <td className="px-4 py-3 text-right">
                        {number.format(p.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <>
            <div className="relative mt-3">
              {empty && emptyMessage ? (
                <p className="absolute inset-0 m-0 flex items-center justify-center px-5 text-center text-base leading-relaxed text-(--t-ink-dim)">
                  {emptyMessage}
                </p>
              ) : null}
              <div
                className="flex h-40 items-end gap-1 border-b border-(--t-border-line)"
                role="img"
                aria-label={
                  empty
                    ? title + ": no activity"
                    : title +
                      ". " +
                      valueLabel +
                      " per day; use the daily table for all values."
                }
              >
                {points.map((p, index) => (
                  <span
                    key={p.date}
                    aria-hidden="true"
                    title={
                      date(p.date) +
                      ": " +
                      number.format(p.value) +
                      " " +
                      valueLabel.toLowerCase()
                    }
                    className={cn(
                      "min-w-0 flex-1 rounded-t-[4px]",
                      empty
                        ? "bg-(--t-border-line)"
                        : ghost ||
                            (highlightLast && index !== points.length - 1)
                          ? "bg-(--t-accent-primary)/35"
                          : "bg-(--t-accent-primary)"
                    )}
                    style={{
                      height:
                        Math.max(empty ? 1 : 2, (p.value / max) * 100) + "%",
                    }}
                  />
                ))}
              </div>
            </div>
            {points.length ? (
              <div
                aria-hidden="true"
                className="mt-2 flex justify-between text-sm text-(--t-ink-dim)"
              >
                <span>{date(points[0]!.date)}</span>
                <span>{endLabel ?? date(points.at(-1)!.date)}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
