"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  availableNow,
  COMPARE_PLANS,
  type CompareGroup,
  compareGroups,
  shortPrice,
} from "@/lib/plan-compare"
import { planCard } from "@/lib/plans"

import { PlanSectionHeader } from "./PlanBits"
import { PlanCompareCell } from "./PlanCompareCell"

const GROUPS = compareGroups()
const NOW = availableNow(GROUPS)
/** Groups open on first load: the free basics everyone gets. */
const OPEN_BY_DEFAULT = GROUPS.slice(0, 2).map((g) => g.id)
const PRO_TINT = "#F6F5FE"
const STICKY = "max-sm:sticky max-sm:left-0 max-sm:z-[1]"

/** "2 available now · 2 on the roadmap" for a group's header row. */
function groupSummary(group: CompareGroup): string {
  const now = group.rows.filter((r) =>
    Object.values(r.cells).includes("yes")
  ).length
  const soon = group.rows.length - now

  return [
    now > 0 ? `${now} available now` : null,
    soon > 0 ? `${soon} on the roadmap` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function GroupHeader({
  group,
  open,
  onToggle,
}: {
  readonly group: CompareGroup
  readonly open: boolean
  readonly onToggle: () => void
}) {
  return (
    <tr>
      <th
        className="border-b p-0 text-left"
        colSpan={COMPARE_PLANS.length + 1}
        id={`compare-${group.id}`}
        scope="rowgroup"
        style={{ background: T.bg.surface, borderColor: T.border.line }}
      >
        <button
          aria-controls={group.rows.map((r) => `compare-row-${r.id}`).join(" ")}
          aria-expanded={open}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--t-bg-muted) ${STICKY}`}
          onClick={onToggle}
          type="button"
        >
          <Icon
            aria-hidden="true"
            className="shrink-0 transition-transform"
            height={18}
            icon="mdi:chevron-right"
            style={{
              color: T.accent.primary,
              transform: open ? "rotate(90deg)" : undefined,
            }}
            width={18}
          />
          <span className="text-[15px] font-bold" style={{ color: T.ink.base }}>
            {group.title}
          </span>
          <span
            className="text-[13.5px] font-medium"
            style={{ color: T.ink.dim }}
          >
            {groupSummary(group)}
          </span>
        </button>
      </th>
    </tr>
  )
}

/** Every plan against every feature, in collapsible groups, with a "built only" filter. */
export function PlanCompareTable() {
  const tUi = useUiTranslations("ui")

  const [nowOnly, setNowOnly] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(OPEN_BY_DEFAULT)
  )
  const groups = nowOnly ? NOW : GROUPS
  const allOpen = groups.every((g) => open.has(g.id))
  const rowCount = groups
    .filter((g) => open.has(g.id))
    .reduce((n, g) => n + g.rows.length, 0)

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })

  return (
    <section aria-labelledby="compare-h">
      <PlanSectionHeader
        control={
          <label
            className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold"
            style={{ borderColor: T.border.hi }}
          >
            <input
              checked={nowOnly}
              className="size-[18px]"
              onChange={(e) => setNowOnly(e.target.checked)}
              style={{ accentColor: "var(--t-accent-primary)" }}
              type="checkbox"
            />
            Only show what’s available now
          </label>
        }
        id="compare-h"
        sub={
          <>
            Features marked “Soon” are on the roadmap and not yet available.
            Open a group to see its features.
            <br />
            <button
              className="mt-1 text-[15px] font-semibold underline underline-offset-[3px]"
              onClick={() =>
                setOpen(allOpen ? new Set() : new Set(GROUPS.map((g) => g.id)))
              }
              style={{ color: T.accent.primary }}
              type="button"
            >
              {allOpen ? "Collapse all groups" : "Expand all groups"}
            </button>
          </>
        }
        title={tUi("compare_every_plan")}
      />
      <p aria-live="polite" className="sr-only">
        Showing {rowCount} features
      </p>
      <div
        className="overflow-x-auto rounded-[22px] border bg-white"
        style={{ borderColor: T.border.line }}
      >
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr>
              <th
                className={`w-[38%] border-b bg-white px-4 py-4 text-left text-[14px] font-semibold ${STICKY}`}
                scope="col"
                style={{ borderColor: T.border.line, color: T.ink.dim }}
              >
                Feature
              </th>
              {COMPARE_PLANS.map((key) => {
                const plan = planCard(key)

                return (
                  <th
                    key={key}
                    className="border-b px-3 py-4 text-center"
                    scope="col"
                    style={{
                      borderColor: T.border.line,
                      background: key === "pro" ? PRO_TINT : undefined,
                    }}
                  >
                    <span
                      className="block text-[19px] leading-tight whitespace-nowrap"
                      style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                    >
                      {plan.name}
                    </span>
                    <span
                      className="mt-0.5 block text-[13px] font-medium"
                      style={{ color: T.ink.dim }}
                    >
                      {shortPrice(plan.price)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          {groups.map((group) => {
            const isOpen = open.has(group.id)

            return (
              <tbody key={group.id}>
                <GroupHeader
                  group={group}
                  onToggle={() => toggle(group.id)}
                  open={isOpen}
                />
                {group.rows.map((row) => (
                  <tr
                    key={row.id}
                    hidden={!isOpen}
                    id={`compare-row-${row.id}`}
                  >
                    <th
                      className={`border-b bg-white px-4 py-3 text-left font-normal ${STICKY} max-sm:min-w-[180px]`}
                      scope="row"
                      style={{
                        borderColor: T.border.divider,
                        color: T.ink.base,
                      }}
                    >
                      {row.label}
                    </th>
                    {COMPARE_PLANS.map((key) => (
                      <td
                        key={key}
                        className="border-b px-3 py-3 text-center"
                        style={{
                          borderColor: T.border.divider,
                          background: key === "pro" ? PRO_TINT : undefined,
                        }}
                      >
                        <PlanCompareCell cell={row.cells[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    </section>
  )
}
