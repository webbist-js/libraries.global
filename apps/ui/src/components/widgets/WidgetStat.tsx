"use client"
import { FACILITY_CHECKLIST, widgetMetric } from "@repo/shared-data"

import { WIDGET_DATA_COLORS } from "@/components/widgets/appearance"
import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { widgetCopy } from "@/lib/widgets/copy"

export function WidgetStat({
  data,
}: {
  readonly data: WidgetPresentationData
}) {
  const { config: c, spec, rows } = data
  const t = (text: string) => widgetCopy(c.locale, text)
  const accent = WIDGET_DATA_COLORS[c.accent]
  const metric = widgetMetric(rows, { ...spec, groups: [] }, c)

  return (
    <div>
      <p className="my-2 font-sans text-6xl" style={{ color: accent }}>
        {c.metric === "libraries"
          ? rows.length
          : c.chartMode === "percentage"
            ? metric[0]?.percentage === null
              ? "—"
              : `${metric[0]?.percentage ?? 0}%`
            : (metric[0]?.yes ?? 0)}
      </p>
      <p className="text-sm">
        {c.metric === "libraries"
          ? t("libraries in this selection")
          : `${t(FACILITY_CHECKLIST[c.facility]?.label ?? "")}: ${metric[0]?.yes ?? 0} ${t("yes,")} ${metric[0]?.no ?? 0} ${t("no,")} ${metric[0]?.unknown ?? 0} ${t("not recorded. Percentages use")} ${metric[0]?.recorded ?? 0} ${t("recorded answers.")}`}
      </p>
    </div>
  )
}
