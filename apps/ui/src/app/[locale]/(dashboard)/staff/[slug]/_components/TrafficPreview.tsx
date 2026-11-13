import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { BarSeries, KpiTile } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link, routing } from "@/lib/navigation"
import {
  TRAFFIC_RANGES,
  type TrafficRange,
  type TrafficSummary,
} from "@/lib/staff/traffic-source"

/** "7 Oct" from a calendar date, in the route's language. */
const shortDay = (date: string, locale: string, year = false) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(parsed)
}

const card = "rounded-[20px] border p-6"

/**
 * The Traffic tab's report: four KPI tiles with change lines, page views per
 * day (bars, or a table) and where visitors came from. A server component:
 * the range comes from `?range=`, so the 7 / 30 / 90 control is three links
 * styled as a segmented control. Every figure is measured; there is no
 * sample mode.
 */
export function TrafficPreview({
  summary,
  rangeHref,
  locale = routing.defaultLocale,
}: {
  readonly summary: TrafficSummary
  /** Where each range link goes, e.g. `?range=7`. */
  readonly rangeHref: (range: TrafficRange) => string
  /** The route locale, for numbers and dates. */
  readonly locale?: string
}) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const period = `${summary.range} days`
  const number = new Intl.NumberFormat(locale)
  const panel = { background: T.bg.deep, borderColor: T.border.line }

  return (
    <div className="flex flex-col gap-6">
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
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold no-underline"
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
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          Complete days to {shortDay(summary.through, locale, true)} (
          {summary.timeZone})
        </p>
      </div>
      {summary.incomplete ? (
        <p
          role="status"
          className="m-0 flex items-start gap-2 rounded-[16px] border p-4 text-sm"
          style={{
            background: T.bg.surface,
            borderColor: T.border.line,
            color: T.ink.base,
          }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:information-outline"
            width={18}
            className="mt-0.5 shrink-0"
            style={{ color: T.accent.primary }}
          />
          {tStatic(
            "staffRoute.google_withheld_or_grouped_some_of_this_period_s_data_usually_because_the_numbers_are_small_treat_th"
          )}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.kpis.map((kpi) => (
          <KpiTile
            key={kpi.key}
            label={kpi.label}
            value={number.format(kpi.value)}
            change={
              kpi.changePct === null
                ? undefined
                : { pct: kpi.changePct, period }
            }
          />
        ))}
      </div>
      <section className={card} style={panel}>
        <BarSeries
          title={tUi("page_views_per_day")}
          heading="h2"
          points={summary.viewsPerDay.map((p) => ({
            date: shortDay(p.date, locale),
            value: p.value,
          }))}
        />
      </section>
      <section
        className={card}
        style={panel}
        aria-labelledby="traffic-referrers-heading"
      >
        <h2 id="traffic-referrers-heading" className="type-panel-title m-0">
          {tStatic("staffRoute.where_visitors_came_from")}
        </h2>
        {summary.referrers.length ? (
          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {summary.referrers.map((row) => (
              <li key={row.label} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm">
                  <span className="font-semibold" style={{ color: T.ink.base }}>
                    {row.label}
                  </span>
                  <span className="tabular-nums" style={{ color: T.ink.dim }}>
                    {row.pct}%
                  </span>
                </span>
                <span
                  className="block h-2 rounded-full"
                  style={{ background: T.bg.muted }}
                  role="img"
                  aria-label={`${row.label}: ${row.pct} percent`}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${row.pct}%`,
                      background: T.action.primary,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-4 text-sm" style={{ color: T.ink.dim }}>
            No visits recorded in the last {period}.
          </p>
        )}
      </section>
    </div>
  )
}
