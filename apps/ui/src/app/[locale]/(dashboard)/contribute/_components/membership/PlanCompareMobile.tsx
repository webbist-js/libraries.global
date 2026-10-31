"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId } from "react"

import { PlanCompareCell } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareCell"
import { T } from "@/lib/design-tokens"
import {
  useMembershipContent,
  useMembershipPlan,
  useMembershipShortPrice,
  useMembershipSummary,
} from "@/lib/localized-plans"
import pricing from "@/lib/membership-pricing.json"
import { COMPARE_PLANS, type CompareGroup } from "@/lib/plan-compare"
import type { PlanCardKey } from "@/lib/plans"

/** The two mobile plan choices live alongside the shared comparison controls. */
export function PlanCompareSelectors({
  selected,
  baseline,
  onSelected,
  onBaseline,
}: {
  readonly selected: PlanCardKey
  readonly baseline: PlanCardKey
  readonly onSelected: (key: PlanCardKey) => void
  readonly onBaseline: (key: PlanCardKey) => void
}) {
  const planCard = useMembershipPlan()
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
          <select
            id={choice.id}
            className="min-h-11 w-full rounded-[12px] border border-(--t-border-hi) bg-(--t-bg-deep) px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            value={choice.value}
            onChange={(event) =>
              choice.onChange(event.target.value as PlanCardKey)
            }
          >
            {COMPARE_PLANS.map((key) => (
              <option key={key} disabled={key === choice.other} value={key}>
                {planCard(key).name}
              </option>
            ))}
          </select>
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
  readonly groups: CompareGroup[]
  readonly open: ReadonlySet<string>
  readonly onToggle: (id: string) => void
  readonly selected: PlanCardKey
  readonly baseline: PlanCardKey
}) {
  const m = useMembershipContent()
  const planCard = useMembershipPlan()
  const shortPrice = useMembershipShortPrice()
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
                      first: planCard(baseline).name,
                      second: planCard(selected).name,
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
                            {planCard(key).name}
                          </span>
                          <span className="mt-1 block text-xs text-(--t-ink-dim)">
                            {shortPrice(planCard(key).price)}
                            {key === "team" ? ` ${m("copy.exVat")}` : ""}
                          </span>
                          {key === "team" ? (
                            <span className="mt-1 block text-xs font-normal text-(--t-ink-dim)">
                              {m("copy.teamSeats", {
                                count: pricing.team.includedSeats,
                              })}
                            </span>
                          ) : null}
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
                          {row.label}
                        </th>
                        {columns.map((key) => (
                          <td
                            key={key}
                            className={`border-t border-(--t-divider) px-1 py-3 text-center ${key === selected ? "bg-(--t-accent-chip)" : ""}`}
                          >
                            <PlanCompareCell
                              cell={row.cells[key]}
                              label={row.cellLabels?.[key]}
                              isExport={row.cellLabelIsExport}
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
