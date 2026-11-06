"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId } from "react"

import { PlanCompareCell } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareCell"
import { PlanRowLabel } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanRoadmapLink"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"
import {
  type LocalizedGroup,
  useCompareColumn,
  useMembershipContent,
  useMembershipSummary,
} from "@/lib/localized-plans"
import { COMPARE_COLUMNS, type CompareColumn } from "@/lib/plan-compare"

/** The two mobile plan choices live alongside the shared comparison controls. */
export function PlanCompareSelectors({
  selected,
  baseline,
  onSelected,
  onBaseline,
}: {
  readonly selected: CompareColumn
  readonly baseline: CompareColumn
  readonly onSelected: (key: CompareColumn) => void
  readonly onBaseline: (key: CompareColumn) => void
}) {
  const column = useCompareColumn()
  const controlId = useId()
  const t = useTranslations("membershipCompare")

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        {
          id: `${controlId}-first`,
          label: t("firstPlan"),
          value: baseline,
          other: selected,
          onChange: onBaseline,
        },
        {
          id: `${controlId}-second`,
          label: t("secondPlan"),
          value: selected,
          other: baseline,
          onChange: onSelected,
        },
      ].map((choice) => (
        <div
          key={choice.label}
          className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold"
        >
          <label htmlFor={choice.id}>{choice.label}</label>
          <SelectField
            id={choice.id}
            className="min-h-11 w-full rounded-[12px] border border-(--t-border-hi) bg-(--t-bg-deep) px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            value={String(choice.value ?? "")}
            onValueChange={(selectedValue) =>
              choice.onChange(selectedValue as CompareColumn)
            }
            options={COMPARE_COLUMNS.map((key) => ({
              value: String(key),
              label: column(key).name,
              disabled: key === choice.other,
            }))}
          />
        </div>
      ))}
    </div>
  )
}

export function PlanCompareMobile({
  groups,
  open,
  onToggle,
  selected,
  baseline,
}: {
  readonly groups: LocalizedGroup[]
  readonly open: ReadonlySet<string>
  readonly onToggle: (id: string) => void
  readonly selected: CompareColumn
  readonly baseline: CompareColumn
}) {
  const m = useMembershipContent()
  const column = useCompareColumn()
  const compareGroupSummary = useMembershipSummary()
  const columns = [baseline, selected]

  return (
    <div className="md:hidden" role="region" aria-label={m("copy.compareTwo")}>
      <div className="overflow-hidden rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep)">
        {groups.map((group) => {
          const expanded = open.has(group.id)
          const id = `mobile-compare-${group.id}`

          return (
            <section
              key={group.id}
              className="border-b border-(--t-border-line) last:border-b-0"
            >
              <h3 className="type-h3 m-0">
                <button
                  className="flex min-h-14 w-full items-center gap-2 bg-(--t-bg-surface) p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  aria-controls={id}
                  aria-expanded={expanded}
                  onClick={() => onToggle(group.id)}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className="shrink-0 text-(--t-accent-primary)"
                    height={18}
                    icon={expanded ? "mdi:chevron-down" : "mdi:chevron-right"}
                    width={18}
                  />
                  <span>
                    <span className="block text-sm font-bold">
                      {group.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-(--t-ink-dim)">
                      {compareGroupSummary(group)}
                    </span>
                  </span>
                </button>
              </h3>
              <div hidden={!expanded} id={id}>
                <table className="w-full table-fixed border-collapse text-sm">
                  <caption className="sr-only">
                    {m("copy.comparisonCaption", {
                      group: group.title,
                      first: column(baseline).name,
                      second: column(selected).name,
                    })}
                  </caption>
                  <thead>
                    <tr>
                      <th
                        className="w-[48%] px-3 py-3 text-left text-xs text-(--t-ink-dim)"
                        scope="col"
                      >
                        {m("copy.feature")}
                      </th>
                      {columns.map((key) => (
                        <th
                          key={key}
                          className={`px-1 py-3 text-center font-medium ${key === selected ? "bg-(--t-accent-chip)" : ""}`}
                          scope="col"
                        >
                          <span
                            className="block text-base leading-tight"
                            style={{
                              fontFamily: T.font.sans,
                            }}
                          >
                            {column(key).name}
                          </span>
                          <span className="mt-1 block text-xs text-(--t-ink-dim)">
                            {column(key).price}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <th
                          className="border-t border-(--t-divider) px-3 py-3 text-left leading-[1.5] font-normal"
                          scope="row"
                        >
                          <PlanRowLabel
                            label={row.label}
                            roadmapKey={row.roadmapKey}
                          />
                        </th>
                        {columns.map((key) => (
                          <td
                            key={key}
                            className={`border-t border-(--t-divider) px-1 py-3 text-center ${key === selected ? "bg-(--t-accent-chip)" : ""}`}
                          >
                            <PlanCompareCell
                              cell={row.cells[key]}
                              label={row.cellLabels[key]}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
