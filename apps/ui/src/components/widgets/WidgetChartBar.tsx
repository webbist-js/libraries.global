"use client"
import type { widgetMetric, WidgetConfig } from "@repo/shared-data"

import { widgetCopy } from "@/lib/widgets/copy"

type Series = ReturnType<typeof widgetMetric>

export function WidgetChartBar({
  m,
  metric,
  c,
  accent,
}: {
  readonly m: Series[number]
  readonly metric: Series
  readonly c: WidgetConfig
  readonly accent: string
}) {
  const t = (text: string) => widgetCopy(c.locale, text)
  const vertical = c.orientation === "vertical"
  const axis = vertical ? "height" : "width"

  const max =
    c.metric === "libraries"
      ? Math.max(1, ...metric.map((g) => g.total))
      : Math.max(1, m.total)
  const percent = c.chartMode === "percentage" && c.metric === "facility",
    value = percent ? (m.percentage ?? 0) : m.yes,
    denominator = percent ? 100 : max

  return (
    <div
      className={
        vertical
          ? "flex min-w-28 flex-1 flex-col justify-end gap-2"
          : "space-y-2"
      }
    >
      <p className="m-0 text-sm font-semibold">
        {m.id === "all" ? t(m.name) : m.name}
      </p>
      <div
        className={`flex overflow-hidden rounded-lg bg-(--t-bg-surface) ${vertical ? "h-40 flex-col-reverse" : "h-7"}`}
        role="img"
        aria-label={barDescription(m, percent, c.locale)}
      >
        <span
          style={{
            background: accent,
            [axis]: `${(value / denominator) * 100}%`,
          }}
        />
        {!percent && c.metric === "facility" ? (
          <>
            <span
              style={{
                background: "#8A8799",
                [axis]: `${(m.no / max) * 100}%`,
              }}
            />
            <span
              style={{
                background:
                  "repeating-linear-gradient(135deg,#E7E3DB 0 5px,#fff 5px 10px)",
                [axis]: `${(m.unknown / max) * 100}%`,
              }}
            />
          </>
        ) : null}
      </div>
      {c.valueLabels ? (
        <p className="m-0 text-sm">{barValueLabel(m, c, percent)}</p>
      ) : null}
    </div>
  )
}

function barDescription(m: Series[number], percent: boolean, locale: string) {
  const t = (text: string) => widgetCopy(locale, text)
  const name = m.id === "all" ? t(m.name) : m.name
  const percentage =
    m.percentage === null
      ? "percentage unavailable"
      : `${m.percentage}% ${t("of")} ${m.recorded} ${t("recorded")}`

  return `${name}: ${m.yes} yes, ${m.no} no, ${m.unknown} not recorded${percent ? `; ${percentage}` : ""}`
}

function barValueLabel(m: Series[number], c: WidgetConfig, percent: boolean) {
  const t = (text: string) => widgetCopy(c.locale, text)
  const value = percent
    ? m.percentage === null
      ? t("Not recorded")
      : `${m.percentage}% ${t("of")} ${m.recorded} ${t("recorded")}`
    : `${m.yes} ${t("of")} ${m.total}`

  return (
    value +
    (c.metric === "facility" ? ` · ${m.unknown} ${t("not recorded")}` : "")
  )
}
