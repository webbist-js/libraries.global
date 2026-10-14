"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { T } from "@/lib/design-tokens"
import pricing from "@/lib/membership-pricing.json"
import {
  availableNow,
  COMPARE_PLANS,
  type CompareGroup,
  compareGroups,
  compareGroupSummary,
  shortPrice,
} from "@/lib/plan-compare"
import { planCard, type PlanCardKey } from "@/lib/plans"

import { PlanSectionHeader } from "./PlanBits"
import { PlanCompareCell } from "./PlanCompareCell"
import { PlanCompareMobile } from "./PlanCompareMobile"

const GROUPS = compareGroups()
const NOW = availableNow(GROUPS)
/** Lead with the differences between memberships; free basics remain available. */
const OPEN_BY_DEFAULT = ["supporting", "atlas"]
const PRO_TINT = "#F6F5FE"
const STICKY = "max-sm:sticky max-sm:left-0 max-sm:z-[1]"

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
            {compareGroupSummary(group)}
          </span>
        </button>
      </th>
    </tr>
  )
}

/** Every plan against every feature, in collapsible groups, with a "built only" filter. */
export function PlanCompareTable({
  currentPlan,
}: { readonly currentPlan?: string } = {}) {
  const tUi = useUiTranslations("ui")

  const [selectedPlan, setSelectedPlan] = useState<PlanCardKey>("pro")
  const [baseline, setBaseline] = useState<PlanCardKey>("free")
  const mobileBaseline =
    baseline === selectedPlan
      ? selectedPlan === "public"
        ? "free"
        : "public"
      : baseline
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
    <section
      aria-labelledby="compare-h"
      id="compare-plans"
      className="scroll-mt-24"
    >
      <PlanSectionHeader
        control={
          <label
            className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold"
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
            Open a group to see its features.{" "}
            <span className="hidden md:inline">
              Select a plan heading to highlight its column.
            </span>
            <span className="md:hidden">
              Choose two plans below to compare them.
            </span>
            <br />
            <button
              className="mt-1 inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-[3px]"
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
      <PlanCompareMobile
        groups={groups}
        open={open}
        onToggle={toggle}
        selected={selectedPlan}
        baseline={mobileBaseline}
        onSelected={setSelectedPlan}
        onBaseline={setBaseline}
      />
      <div
        className="hidden overflow-x-auto rounded-[22px] border bg-white [contain:paint] md:block"
        role="region"
        aria-label="What each plan includes"
        tabIndex={0}
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
                      background: key === selectedPlan ? PRO_TINT : undefined,
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedPlan === key}
                      onClick={() => setSelectedPlan(key)}
                      className="flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span
                        className="text-[19px] leading-tight"
                        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                      >
                        {plan.name}
                      </span>
                      <span className="text-[12px] font-medium text-(--t-ink-dim)">
                        {shortPrice(plan.price)}
                        {key === "team" ? " ex VAT" : ""}
                      </span>
                      {key === "team" ? (
                        <span className="text-[11px] font-normal text-(--t-ink-dim)">
                          Standard · {pricing.team.includedSeats} seats
                        </span>
                      ) : null}
                      {key === currentPlan ? (
                        <span className="text-[11px] font-semibold text-(--t-accent-primary)">
                          Your plan
                        </span>
                      ) : null}
                    </button>
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
                          background:
                            key === selectedPlan ? PRO_TINT : undefined,
                        }}
                      >
                        <PlanCompareCell
                          cell={row.cells[key]}
                          label={row.cellLabels?.[key]}
                        />
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
