"use client"

import { useTranslations as useUiTranslations } from "next-intl"

import { Drawer } from "@/components/ds/Drawer"
import GlobalLink from "@/components/global/GlobalLink"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import {
  ATLAS_SHEET_ROW_IDS,
  type CompareCell,
  compareRowsById,
} from "@/lib/plan-compare"
import {
  planCard,
  type PlanCardKey,
  PRICES_ARE_PLACEHOLDERS,
  priceHeadline,
} from "@/lib/plans"

import { Icon } from "./atlas-ui"
import { type LayerId, layerDef, type Tier } from "./atlas.logic"

type SheetPlan = "public" | "free" | "supporter" | "pro" | "team"
const SHEET_PLANS: readonly SheetPlan[] = [
  "public",
  "free",
  "supporter",
  "pro",
  "team",
]

// Names and prices come from lib/plans; these short lines fit the narrow
// columns (the /pro page carries the full "who" copy).
const TAGLINE: Record<SheetPlan, string> = {
  public: "No account",
  free: "Free sign-up",
  supporter: "History & small exports",
  pro: "For researchers",
  team: "Libraries & councils",
}

const PLANS = SHEET_PLANS.map(planCard)
const PRO_TINT = "#F6F5FE"

type SheetRow = {
  id: string
  label: string
  cells: Record<string, CompareCell>
  cellLabelIsExport?: boolean
  cellLabels?: Partial<Record<PlanCardKey, string>>
}

/** A row for a set of Atlas layers: from their tier up, ✓ once all are built. */
function layerRow(label: string, ids: LayerId[]): SheetRow {
  const defs = ids.map(layerDef)
  const from = defs[0]!.tier
  const status: CompareCell = defs.every((d) => d.ready) ? "yes" : "soon"
  const rank: Record<Tier, number> = { public: 0, free: 1, pro: 2 }
  const planRank: Record<SheetPlan, number> = {
    public: 0,
    free: 1,
    supporter: 1,
    pro: 2,
    team: 2,
  }

  return {
    id: `layers-${ids.join("-")}`,
    label,
    cells: Object.fromEntries(
      SHEET_PLANS.map((p) => [p, planRank[p] >= rank[from] ? status : "no"])
    ),
  }
}

function sheetRows(): SheetRow[] {
  const [record, search, follow, ...pro] = compareRowsById(ATLAS_SHEET_ROW_IDS)

  return [
    record!,
    search!,
    layerRow("Density, open-late and closures layers", [
      "density",
      "openLate",
      "closures",
    ]),
    layerRow("Mobile library routes and stops", ["mobile"]),
    follow!,
    layerRow("Population density and supported grids", ["population"]),
    layerRow("Accessibility, events and completeness layers", [
      "access",
      "events",
      "complete",
    ]),
    ...pro,
  ]
}

const ROWS = sheetRows()

/** A tick, a "Soon" chip or a dash, each with a text label. */
function SheetCell({
  cell,
  label,
  isExport = false,
}: {
  readonly cell: CompareCell
  readonly isExport?: boolean
  readonly label?: string
}) {
  const tUi = useUiTranslations("ui")

  if (cell === "yes" && label)
    return (
      <span className="font-semibold">
        {label}
        {isExport ? (
          <span className="sr-only"> libraries per download</span>
        ) : null}
      </span>
    )

  if (cell === "yes")
    return (
      <span className="inline-flex" style={{ color: T.accent.ok }}>
        <Icon name="check" size={16} stroke={2.4} />
        <span className="sr-only">Included</span>
      </span>
    )
  if (cell === "soon")
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap"
        style={{ background: T.accent.chip, color: T.accent.primaryHover }}
      >
        <Icon name="clock" size={12} />
        {tUi("soon")}
        <span className="sr-only">: coming soon</span>
      </span>
    )

  return (
    <span style={{ color: "#8A8799" }}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not included</span>
    </span>
  )
}

function SeeAllPlansLink() {
  return (
    <GlobalLink
      href="/contribute/membership"
      {...analyticsAttributes("membership_interest", {
        interaction_source: "upgrade_prompt",
        action_type: "compare",
      })}
      className="text-[14px] font-semibold underline underline-offset-[3px]"
      style={{ color: T.accent.primary }}
    >
      See all plans
    </GlobalLink>
  )
}

const OUTLINE_PILL =
  "inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold no-underline"

function PlanCta({
  plan,
  current,
  tier,
  signInHref,
}: {
  readonly plan: (typeof PLANS)[number]
  readonly current: PlanCardKey
  readonly tier: Tier
  readonly signInHref: string
}) {
  const tUi = useUiTranslations("ui")

  if (plan.key === current)
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <span
          className="text-[14px] whitespace-nowrap"
          style={{ color: T.ink.dim }}
        >
          You’re here
        </span>
        {/* Pro and Team members land on the Pro column, which would
            otherwise lose its link to the plans page. */}
        {plan.cta.kind === "soon" ? <SeeAllPlansLink /> : null}
      </span>
    )

  if (plan.key === "free" && tier === "public")
    return (
      <GlobalLink
        href={signInHref}
        className={OUTLINE_PILL}
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        {tUi("sign_in")}{" "}
      </GlobalLink>
    )

  if (plan.cta.kind === "contact" && plan.cta.href)
    return (
      <a
        href={plan.cta.href}
        className={OUTLINE_PILL}
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        {plan.cta.label}
      </a>
    )

  if (plan.cta.kind === "soon")
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <span
          className="inline-flex items-center gap-1 text-[14px] font-semibold whitespace-nowrap"
          style={{ color: T.ink.dim }}
        >
          <Icon name="clock" size={15} />
          {plan.cta.label}
        </span>
        <SeeAllPlansLink />
      </span>
    )

  return null
}

export function AtlasPlansSheet({
  tier,
  currentPlan = tier,
  onClose,
  signInHref,
}: {
  readonly tier: Tier
  readonly currentPlan?: PlanCardKey
  readonly onClose: () => void
  readonly signInHref: string
}) {
  const current: PlanCardKey = currentPlan

  return (
    <Drawer
      titleId="atlas-plans-h"
      title={
        <>
          Library facts are free.{" "}
          <em className="font-normal" style={{ color: T.accent.primary }}>
            Always.
          </em>
        </>
      }
      onClose={onClose}
      size="xl"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
        <p
          className="mt-0 mb-5 max-w-[680px] text-[17px]"
          style={{ color: T.ink.dim }}
        >
          Addresses, hours, services and every community record stay open to
          everyone. Pro supports the analysis tools and data processing that
          cost money to run, and help keep the rest free.
        </p>
        <div
          className="max-w-full shrink-0 overflow-x-auto rounded-[22px] border bg-white [contain:paint]"
          style={{ borderColor: T.border.line }}
        >
          <table className="w-full min-w-[680px] border-collapse text-[15px]">
            <caption className="sr-only">What each plan includes</caption>
            <thead>
              <tr>
                <td
                  className="w-[32%] border-b bg-white max-sm:sticky max-sm:left-0 max-sm:z-[1]"
                  style={{ borderColor: T.border.hi }}
                />
                {PLANS.map((p) => (
                  <th
                    key={p.key}
                    scope="col"
                    className="border-b px-3.5 pt-4 pb-3.5 text-left align-top font-bold"
                    style={{
                      borderColor: T.border.hi,
                      background: p.key === "pro" ? T.accent.chip : "#fff",
                    }}
                  >
                    <span className="block text-[15px] whitespace-nowrap">
                      {p.name}
                    </span>
                    <span
                      className="my-0.5 block text-[22px] leading-tight font-medium"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {priceHeadline(p.price)}
                    </span>
                    <span
                      className="block text-[14px] font-medium whitespace-nowrap"
                      style={{ color: T.ink.dim }}
                    >
                      {TAGLINE[p.key as SheetPlan]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="border-b bg-white px-4 py-2.5 text-left font-medium max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:min-w-[170px]"
                    style={{ borderColor: T.border.divider }}
                  >
                    {row.label}
                  </th>
                  {PLANS.map((p) => (
                    <td
                      key={p.key}
                      className="border-b px-3.5 py-2.5 text-center"
                      style={{
                        borderColor: T.border.divider,
                        background: p.key === "pro" ? PRO_TINT : undefined,
                      }}
                    >
                      <SheetCell
                        cell={row.cells[p.key] ?? "no"}
                        label={row.cellLabels?.[p.key]}
                        isExport={row.cellLabelIsExport}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="bg-white max-sm:sticky max-sm:left-0 max-sm:z-[1]" />
                {PLANS.map((p) => (
                  <td
                    key={p.key}
                    className="px-3.5 py-3.5 text-left"
                    style={{
                      background: p.key === "pro" ? PRO_TINT : undefined,
                    }}
                  >
                    <PlanCta
                      plan={p}
                      current={current}
                      tier={tier}
                      signInHref={signInHref}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className="mt-5 grid gap-4 text-[14px] leading-normal sm:grid-cols-2"
          style={{ color: "#45435A" }}
        >
          <p className="m-0 flex gap-2">
            <Icon name="check" size={18} color={T.accent.ok} />
            <span>
              <strong style={{ color: T.ink.base }}>
                Free Pro for library staff, students and charities.
              </strong>{" "}
              It renews each year.{" "}
              <GlobalLink
                href="/contribute/membership#get-pro-free"
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Ways to get Pro free
              </GlobalLink>
            </span>
          </p>
          <p className="m-0 flex gap-2">
            <Icon name="globe" size={18} color="#4A3F8C" />
            <span>
              <strong style={{ color: T.ink.base }}>
                Open source, open data.
              </strong>{" "}
              Library records are community-maintained open data, and the atlas
              code is open source.
              {PRICES_ARE_PLACEHOLDERS ? " Prices are placeholders." : null}
            </span>
          </p>
        </div>
      </div>
    </Drawer>
  )
}
