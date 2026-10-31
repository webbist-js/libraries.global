"use client"

import {
  FACILITY_CHECKLIST,
  WIDGET_ACCENTS,
  widgetMetric,
} from "@repo/shared-data"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { WidgetChartBar } from "@/components/widgets/WidgetChartBar"
import { useMounted } from "@/hooks/useMounted"
import { widgetCopy } from "@/lib/widgets/copy"

export function WidgetChart({
  data,
}: {
  readonly data: WidgetPresentationData
}) {
  const { config: c, spec, rows } = data
  const t = (text: string) => widgetCopy(c.locale, text)
  const mounted = useMounted()
  const [table, setTable] = useState(c.showTable)
  const accent = WIDGET_ACCENTS[c.accent]
  const metric = widgetMetric(rows, spec, c)

  return (
    <section aria-label={t("Library comparison")}>
      {c.metric === "facility" ? (
        <ul
          className="mb-4 flex list-none flex-wrap gap-4 p-0 text-sm"
          aria-label="Chart legend"
        >
          <li className="flex items-center gap-2">
            <span className="size-4 rounded" style={{ background: accent }} />
            {t("Yes")}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-4 rounded bg-(--t-ink-low)" />
            {t("No")}
          </li>
          <li className="flex items-center gap-2">
            <span
              className="size-4 rounded border"
              style={{
                background:
                  "repeating-linear-gradient(135deg,#E7E3DB 0 5px,#fff 5px 10px)",
              }}
            />
            {t("Not recorded")}
          </li>
        </ul>
      ) : null}
      <p className="mb-4 text-sm">
        {c.metric === "libraries"
          ? t("Library counts")
          : t(FACILITY_CHECKLIST[c.facility]?.label ?? "")}{" "}
        {t("across")} {rows.length} {t("selected libraries.")}{" "}
        {c.metric === "facility"
          ? t(
              "Missing answers are not recorded. Percentages use recorded answers only."
            )
          : t("A library may belong to more than one group.")}
      </p>
      <Button
        variant="link"
        className="mb-3 min-h-11 px-0"
        onClick={() => setTable(!table)}
        aria-expanded={table}
        disabled={!mounted}
      >
        {table ? t("Show chart") : t("Show as table")}
      </Button>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {t("Library comparison data")}
            </caption>
            <thead>
              <tr>
                {(c.metric === "libraries"
                  ? [t("Group"), t("Libraries")]
                  : [
                      t("Group"),
                      t("Libraries"),
                      t("Yes"),
                      t("No"),
                      t("Not recorded"),
                      t("% of recorded"),
                    ]
                ).map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metric.map((m) => (
                <tr key={m.id} className="border-t border-(--t-border-line)">
                  <th scope="row" className="p-3">
                    {m.id === "all" ? t(m.name) : m.name}
                  </th>
                  <td className="p-3">{m.total}</td>
                  {c.metric === "facility" ? (
                    <>
                      <td className="p-3">{m.yes}</td>
                      <td className="p-3">{m.no}</td>
                      <td className="p-3">{m.unknown}</td>
                      <td className="p-3">
                        {m.percentage === null
                          ? t("Not recorded")
                          : `${m.percentage}% ${t("of")} ${m.recorded}`}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={
            c.orientation === "vertical"
              ? "flex min-h-64 items-end gap-4 overflow-x-auto pb-2"
              : "space-y-5"
          }
        >
          {metric.map((m) => (
            <WidgetChartBar
              key={m.id}
              m={m}
              metric={metric}
              c={c}
              accent={accent}
            />
          ))}
        </div>
      )}
    </section>
  )
}
