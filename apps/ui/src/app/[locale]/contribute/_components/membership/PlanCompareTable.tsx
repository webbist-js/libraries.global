"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { PlanSectionHeader } from "@/app/[locale]/contribute/_components/membership/PlanBits"
import { PlanCompareCell } from "@/app/[locale]/contribute/_components/membership/PlanCompareCell"
import {
  PlanCompareMobile,
  PlanCompareSelectors,
} from "@/app/[locale]/contribute/_components/membership/PlanCompareMobile"
import { PlanToggle } from "@/app/[locale]/contribute/_components/membership/PlanToggle"
import { T } from "@/lib/design-tokens"
import {
  useMembershipContent,
  useMembershipGroups,
  useMembershipPlan,
  useMembershipShortPrice,
  useMembershipSummary,
} from "@/lib/localized-plans"
import pricing from "@/lib/membership-pricing.json"
import {
  availableNow,
  COMPARE_PLANS,
  type CompareGroup,
} from "@/lib/plan-compare"
import type { PlanCardKey } from "@/lib/plans"

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
  const compareGroupSummary = useMembershipSummary()

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
          <span className="text-base font-bold" style={{ color: T.ink.base }}>
            {group.title}
          </span>
          <span className="text-sm font-medium" style={{ color: T.ink.dim }}>
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
  const m = useMembershipContent()
  const planCard = useMembershipPlan()
  const shortPrice = useMembershipShortPrice()
  const GROUPS = useMembershipGroups()
  const NOW = availableNow(GROUPS)
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("membershipCompare")

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
  const featureCount = groups.reduce((n, group) => n + group.rows.length, 0)
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
        id="compare-h"
        sub={t("lead")}
        title={tUi("compare_every_plan")}
      />
      <div
        aria-label={t("controls")}
        className="mb-4 rounded-[22px] border border-(--t-border-line) bg-white p-4 sm:p-5"
        role="region"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlanToggle
            label={t("availability")}
            value={nowOnly ? "now" : "all"}
            onChange={(value) => setNowOnly(value === "now")}
            className="bg-(--t-bg-surface)"
            options={[
              { value: "all", label: t("allFeatures") },
              { value: "now", label: t("availableNow") },
            ]}
          />
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-4 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none"
            onClick={() =>
              setOpen(allOpen ? new Set() : new Set(GROUPS.map((g) => g.id)))
            }
            type="button"
          >
            <Icon
              aria-hidden
              icon={
                allOpen
                  ? "mdi:unfold-less-horizontal"
                  : "mdi:unfold-more-horizontal"
              }
              width={18}
              height={18}
            />
            {allOpen ? t("collapseAll") : t("expandAll")}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-(--t-border-line) pt-3 text-sm text-(--t-ink-dim)">
          <p aria-live="polite" aria-atomic="true" className="m-0 font-medium">
            {t("showing", { count: rowCount, total: featureCount })}
          </p>
          <p className="m-0 hidden items-center gap-1.5 md:flex">
            <Icon
              aria-hidden
              icon="mdi:cursor-default-click-outline"
              width={16}
              height={16}
            />
            {t("highlightHint")}
          </p>
        </div>
        <div className="mt-4 md:hidden">
          <PlanCompareSelectors
            selected={selectedPlan}
            baseline={mobileBaseline}
            onSelected={setSelectedPlan}
            onBaseline={setBaseline}
          />
        </div>
      </div>
      <PlanCompareMobile
        groups={groups}
        open={open}
        onToggle={toggle}
        selected={selectedPlan}
        baseline={mobileBaseline}
      />
      <div
        className="hidden overflow-x-auto rounded-[22px] border bg-white [contain:paint] md:block"
        role="region"
        aria-label={m("copy.includes")}
        tabIndex={0}
        style={{ borderColor: T.border.line }}
      >
        <table className="w-full min-w-[720px] border-collapse text-base">
          <caption className="sr-only">{m("copy.includes")}</caption>
          <thead>
            <tr>
              <th
                className={`w-[38%] border-b bg-white px-4 py-4 text-left text-sm font-semibold ${STICKY}`}
                scope="col"
                style={{ borderColor: T.border.line, color: T.ink.dim }}
              >
                {m("copy.feature")}
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
                        className="text-lg leading-tight"
                        style={{ fontFamily: T.font.sans, fontWeight: 500 }}
                      >
                        {plan.name}
                      </span>
                      <span className="text-xs font-medium text-(--t-ink-dim)">
                        {shortPrice(plan.price)}
                        {key === "team" ? ` ${m("copy.exVat")}` : ""}
                      </span>
                      {key === "team" ? (
                        <span className="text-xs font-normal text-(--t-ink-dim)">
                          {m("copy.teamSeats", {
                            count: pricing.team.includedSeats,
                          })}
                        </span>
                      ) : null}
                      {key === currentPlan ? (
                        <span className="text-xs font-semibold text-(--t-accent-primary)">
                          {m("copy.current")}
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
                          isExport={row.cellLabelIsExport}
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
