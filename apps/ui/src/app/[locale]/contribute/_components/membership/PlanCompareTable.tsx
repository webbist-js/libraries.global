"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  availableNow,
  COMPARE_PLANS,
  compareGroups,
  shortPrice,
} from "@/lib/plan-compare"
import { planCard } from "@/lib/plans"

import { PlanSectionHeader } from "./PlanBits"
import { PlanCompareCell } from "./PlanCompareCell"

const GROUPS = compareGroups()
const NOW = availableNow(GROUPS)
const PRO_TINT = "#F6F5FE"
const STICKY = "bg-white max-sm:sticky max-sm:left-0 max-sm:z-[1]"

/** Every plan against every feature, grouped, with a "built only" filter. */
export function PlanCompareTable() {
  const [nowOnly, setNowOnly] = useState(false)
  const groups = nowOnly ? NOW : GROUPS
  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0)

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
        sub="Features marked “Soon” are on the roadmap and not yet available."
        title="Compare every plan"
      />
      <p aria-live="polite" className="sr-only">
        Showing {rowCount} features
      </p>
      <div
        className="overflow-x-auto rounded-[22px] border bg-white"
        style={{ borderColor: T.border.line }}
      >
        <table className="w-full min-w-[720px] border-collapse text-[14.5px]">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr>
              <th
                className={`w-[34%] border-b px-4 py-3.5 text-left align-bottom text-[13px] font-bold ${STICKY}`}
                scope="col"
                style={{ borderColor: T.border.hi, color: T.accent.primary }}
              >
                Feature
              </th>
              {COMPARE_PLANS.map((key) => {
                const plan = planCard(key)

                return (
                  <th
                    key={key}
                    className="border-b px-3 py-3.5 text-center align-bottom"
                    scope="col"
                    style={{
                      borderColor: T.border.hi,
                      background: key === "pro" ? T.accent.chip : undefined,
                    }}
                  >
                    <span
                      className="block text-[17px] whitespace-nowrap"
                      style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                    >
                      {plan.name}
                    </span>
                    <span
                      className="block text-[13px] font-medium"
                      style={{ color: T.ink.dim }}
                    >
                      {shortPrice(plan.price)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id}>
              <tr>
                <th
                  className={`px-4 pt-5 pb-2 text-left text-[13px] font-bold ${STICKY}`}
                  id={`compare-${group.id}`}
                  scope="rowgroup"
                  style={{ color: T.accent.primary }}
                >
                  {group.title}
                </th>
                {COMPARE_PLANS.map((key) => (
                  <td
                    key={key}
                    style={{
                      background: key === "pro" ? PRO_TINT : undefined,
                    }}
                  />
                ))}
              </tr>
              {group.rows.map((row) => (
                <tr key={row.id}>
                  <th
                    className={`border-b px-4 py-2.5 text-left font-medium ${STICKY} max-sm:min-w-[180px]`}
                    scope="row"
                    style={{ borderColor: T.border.divider }}
                  >
                    {row.label}
                  </th>
                  {COMPARE_PLANS.map((key) => (
                    <td
                      key={key}
                      className="border-b px-3 py-2.5 text-center"
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
          ))}
        </table>
      </div>
    </section>
  )
}
