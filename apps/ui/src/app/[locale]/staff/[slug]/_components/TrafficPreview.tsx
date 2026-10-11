import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { BarSeries, KpiTile } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link, routing } from "@/lib/navigation"
import {
  TRAFFIC_RANGES,
  type TrafficRange,
  type TrafficSummary,
} from "@/lib/staff/traffic-source"

/** "7 Oct" from a calendar date, in the route's language. */
const shortDay = (date: string, locale: string) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed)
}

/** "1,2••": a sample numeral with its last digits hidden. */
const elide = (value: string) =>
  value.length > 2 ? `${value.slice(0, -2)}••` : "••"

const card = "rounded-[20px] border p-6"

/**
 * The Traffic tab's report: four KPI tiles with change lines, page views per
 * day (bars, or a table), where visitors came from, and the searches that
 * found the page. A server component: the range comes from `?range=`, so
 * the 7 / 30 / 90 control is three links styled as a segmented control.
 *
 * `ghost` is the plan gate's sample: surface panels, pale bars, elided
 * numerals, no deltas, no range control and no table, so it reads as an
 * illustration beside the pitch rather than live analytics.
 */
export function TrafficPreview({
  summary,
  rangeHref,
  locale = routing.defaultLocale,
  ghost = false,
}: {
  readonly summary: TrafficSummary
  /** Where each range link goes, e.g. `?range=7`. */
  readonly rangeHref: (range: TrafficRange) => string
  /** The route locale, for numbers and dates. */
  readonly locale?: string
  readonly ghost?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const period = `${summary.range} days`
  const number = new Intl.NumberFormat(locale)
  const panel = {
    background: ghost ? T.bg.surface : T.bg.deep,
    borderColor: T.border.line,
  }
  const Heading = ghost ? "p" : "h2"

  return (
    <div className={ghost ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
      {ghost ? null : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label={tUi("report_period")}
            className="inline-flex rounded-full p-1"
            style={{ background: T.bg.muted2 }}
          >
            {TRAFFIC_RANGES.map((range) => {
              const active = range === summary.range

              return (
                <Link
                  key={range}
                  href={rangeHref(range)}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold no-underline"
                  style={{
                    background: active ? T.bg.deep : undefined,
                    color: active ? T.accent.primary : T.ink.dim,
                  }}
                >
                  {range} days
                </Link>
              )
            })}
          </nav>
          {summary.sample ? (
            <p
              className="m-0 flex items-center gap-1.5 text-[13.5px]"
              style={{ color: T.ink.dim }}
            >
              <Icon aria-hidden="true" icon="mdi:flask-outline" width={16} />
              Sample data · illustrative numbers
            </p>
          ) : null}
        </div>
      )}
      <div
        className={
          ghost
            ? "grid gap-3 sm:grid-cols-2"
            : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        {summary.kpis.map((kpi) => (
          <KpiTile
            key={kpi.key}
            label={kpi.label}
            value={
              ghost ? elide(number.format(kpi.value)) : number.format(kpi.value)
            }
            change={{ pct: kpi.changePct, period }}
            ghost={ghost}
          />
        ))}
      </div>
      <section className={card} style={panel}>
        <BarSeries
          title={tUi("page_views_per_day")}
          heading={ghost ? "p" : "h2"}
          ghost={ghost}
          points={summary.viewsPerDay.map((p) => ({
            date: shortDay(p.date, locale),
            value: p.value,
          }))}
        />
      </section>
      <div className={ghost ? "grid gap-4" : "grid gap-6 lg:grid-cols-2"}>
        <section
          className={card}
          style={panel}
          aria-labelledby={ghost ? undefined : "traffic-referrers-heading"}
        >
          <Heading
            id={ghost ? undefined : "traffic-referrers-heading"}
            className="m-0 text-[20px]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: ghost ? T.ink.dim : T.ink.base,
            }}
          >
            Where visitors came from
          </Heading>
          {summary.referrers.length ? (
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {summary.referrers.map((row) => (
                <li key={row.label} className="flex flex-col gap-1">
                  <span className="flex justify-between text-[14px]">
                    <span
                      className="font-semibold"
                      style={{ color: ghost ? T.ink.dim : T.ink.base }}
                    >
                      {row.label}
                    </span>
                    <span style={{ color: T.ink.dim }}>
                      {ghost ? "••%" : `${row.pct}%`}
                    </span>
                  </span>
                  <span
                    className="block h-2 overflow-hidden rounded-full"
                    style={{ background: ghost ? T.bg.muted2 : T.bg.muted }}
                    role="img"
                    aria-label={`${row.label}: ${row.pct} percent`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${row.pct}%`,
                        background: ghost ? T.accent.chip : T.accent.primary,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-4 text-[14px]" style={{ color: T.ink.dim }}>
              No referrers recorded in the last {period}.
            </p>
          )}
        </section>
        {ghost ? null : (
          <section
            className={card}
            style={panel}
            aria-labelledby="traffic-searches-heading"
          >
            <h2
              id="traffic-searches-heading"
              className="m-0 text-[20px]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              Searches that found you
            </h2>
            {summary.searches.length ? (
              <table className="mt-4 w-full text-left text-[14px]">
                <caption className="sr-only">
                  Searches that led to your page in the last {period}
                </caption>
                <thead>
                  <tr style={{ color: T.ink.dim }}>
                    <th scope="col" className="pb-2 font-semibold">
                      {tUi("search")}{" "}
                    </th>
                    <th scope="col" className="pb-2 text-right font-semibold">
                      Visits
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.searches.map((row) => (
                    <tr
                      key={row.query}
                      className="border-t"
                      style={{ borderColor: T.border.divider }}
                    >
                      <th scope="row" className="py-2 font-normal">
                        “{row.query}”
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {number.format(row.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="m-0 mt-4 text-[14px]" style={{ color: T.ink.dim }}>
                No searches recorded in the last {period}. Searches appear once
                people find your page through the site’s search.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
