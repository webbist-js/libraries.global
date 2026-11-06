"use client"

import { Drawer } from "@/components/ds/Drawer"
import GlobalLink from "@/components/global/GlobalLink"
import { useEntitlements } from "@/lib/access-client"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import {
  useCompareColumn,
  useLocalizeRow,
  useMembershipContent,
  useOfferValues,
} from "@/lib/localized-plans"
import {
  ATLAS_SHEET_ROW_IDS,
  type CompareCell,
  type CompareColumn,
  compareRowsById,
} from "@/lib/plan-compare"

import { Icon } from "./atlas-ui"
import { type LayerId, layerDef, type Tier } from "./atlas.logic"

/** The Atlas is about browsing and Reach, so staff rows stay on /plans. */
const SHEET_COLUMNS: readonly CompareColumn[] = [
  "public",
  "explorer",
  "contributor",
  "api",
]
const HIGHLIGHT = "var(--t-bg-selected)"

/** Which columns can switch on a layer of this tier. */
const TIER_COLUMNS: Record<Tier, readonly CompareColumn[]> = {
  public: SHEET_COLUMNS,
  free: ["explorer", "contributor", "api"],
  pro: ["explorer", "contributor", "api"],
  reach: ["contributor", "api"],
}

type SheetRow = {
  id: string
  label: string
  cells: Record<string, CompareCell>
  cellLabels?: Partial<Record<CompareColumn, string>>
}

const LAYER_ROWS: { id: string; layers: LayerId[] }[] = [
  { id: "basics", layers: ["density", "openLate", "closures"] },
  { id: "mobile", layers: ["mobile"] },
  { id: "population", layers: ["population"] },
  { id: "access", layers: ["access", "events", "complete"] },
]

function layerRow(id: string, label: string, ids: LayerId[]): SheetRow {
  const defs = ids.map(layerDef)
  const status: CompareCell = defs.every((d) => d.ready) ? "yes" : "soon"
  const columns = TIER_COLUMNS[defs[0]!.tier]

  return {
    id: `layers-${id}`,
    label,
    cells: Object.fromEntries(
      SHEET_COLUMNS.map((c) => [c, columns.includes(c) ? status : "no"])
    ),
  }
}

function useSheetRows(): SheetRow[] {
  const m = useMembershipContent()
  const localize = useLocalizeRow()
  const [records, map, follow, ...tools] =
    compareRowsById(ATLAS_SHEET_ROW_IDS).map(localize)
  const layers = LAYER_ROWS.map((row) =>
    layerRow(row.id, m(`sheet.layers.${row.id}`), row.layers)
  )

  return [
    records!,
    map!,
    layers[0]!,
    layers[1]!,
    follow!,
    layers[2]!,
    layers[3]!,
    ...tools,
  ]
}

/** A tick, a "Soon" chip or a dash, each with a text label. */
function SheetCell({
  cell,
  label,
}: {
  readonly cell: CompareCell
  readonly label?: string
}) {
  const m = useMembershipContent()

  if (cell === "yes" && label)
    return <span className="text-sm font-semibold">{label}</span>

  if (cell === "yes")
    return (
      <span className="inline-flex" style={{ color: T.accent.ok }}>
        <Icon name="check" size={16} stroke={2.4} />
        <span className="sr-only">{m("copy.included")}</span>
      </span>
    )
  if (cell === "soon")
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
        style={{ background: T.accent.chip, color: T.accent.primaryHover }}
      >
        <Icon name="clock" size={12} />
        {m("copy.soonShort")}
        <span className="sr-only">: {m("copy.soon")}</span>
      </span>
    )

  return (
    <span style={{ color: "var(--t-ink-low)" }}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{m("copy.notIncluded")}</span>
    </span>
  )
}

const OUTLINE_PILL =
  "inline-flex min-h-9 items-center rounded-full border bg-(--t-bg-deep) px-3.5 text-sm font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"

function ColumnCta({
  column,
  current,
  signInHref,
}: {
  readonly column: CompareColumn
  readonly current: CompareColumn
  readonly signInHref: string
}) {
  const m = useMembershipContent()
  if (column === current)
    return (
      <span className="text-sm whitespace-nowrap" style={{ color: T.ink.dim }}>
        {m("sheet.here")}
      </span>
    )
  const link =
    column === "explorer" && current === "public"
      ? { href: signInHref, label: m("sheet.signIn") }
      : column === "contributor" && current !== "api"
        ? { href: "/contribute", label: m("sheet.contribute") }
        : column === "api"
          ? { href: "/developers", label: m("sheet.api") }
          : null
  if (!link) return null

  return (
    <GlobalLink
      href={link.href}
      className={OUTLINE_PILL}
      style={{ borderColor: T.border.hi, color: T.ink.base }}
    >
      {link.label}
    </GlobalLink>
  )
}

export function AtlasPlansSheet({
  open = true,
  tier,
  onClose,
  signInHref,
}: {
  readonly open?: boolean
  readonly tier: Tier
  readonly onClose: () => void
  readonly signInHref: string
}) {
  const m = useMembershipContent()
  const values = useOfferValues()
  const column = useCompareColumn()
  const rows = useSheetRows()
  const { has } = useEntitlements()
  const current: CompareColumn =
    tier === "public"
      ? "public"
      : has("apiCustomer")
        ? "api"
        : tier === "reach"
          ? "contributor"
          : "explorer"

  return (
    <Drawer
      open={open}
      titleId="atlas-plans-h"
      title={
        <>
          {m("sheet.title")}{" "}
          <em className="font-normal" style={{ color: T.accent.primary }}>
            {m("sheet.titleEmphasis")}
          </em>
        </>
      }
      onClose={onClose}
      size="xl"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
        <p
          className="mt-0 mb-5 max-w-[680px] text-base"
          style={{ color: T.ink.dim }}
        >
          {m("sheet.lead", values)}
        </p>
        <div
          className="max-w-full shrink-0 overflow-x-auto rounded-[22px] border bg-(--t-bg-deep) [contain:paint]"
          role="region"
          aria-label={m("copy.includes")}
          tabIndex={0}
          style={{ borderColor: T.border.line }}
        >
          <table className="w-full min-w-[640px] border-collapse text-base">
            <caption className="sr-only">{m("copy.includes")}</caption>
            <thead>
              <tr>
                <td
                  className="w-[34%] border-b bg-(--t-bg-deep) max-sm:sticky max-sm:left-0 max-sm:z-[1]"
                  style={{ borderColor: T.border.hi }}
                />
                {SHEET_COLUMNS.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="border-b px-3.5 pt-4 pb-3.5 text-left align-top font-bold"
                    style={{
                      borderColor: T.border.hi,
                      background: key === current ? T.accent.chip : T.bg.deep,
                    }}
                  >
                    <span className="block text-base">{column(key).name}</span>
                    <span
                      className="mt-0.5 block text-sm font-medium"
                      style={{ color: T.ink.dim }}
                    >
                      {column(key).price}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="border-b bg-(--t-bg-deep) px-4 py-2.5 text-left font-medium max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:min-w-[170px]"
                    style={{ borderColor: T.border.divider }}
                  >
                    {row.label}
                  </th>
                  {SHEET_COLUMNS.map((key) => (
                    <td
                      key={key}
                      className="border-b px-3.5 py-2.5 text-center"
                      style={{
                        borderColor: T.border.divider,
                        background: key === current ? HIGHLIGHT : undefined,
                      }}
                    >
                      <SheetCell
                        cell={row.cells[key] ?? "no"}
                        label={row.cellLabels?.[key]}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="bg-(--t-bg-deep) max-sm:sticky max-sm:left-0 max-sm:z-[1]" />
                {SHEET_COLUMNS.map((key) => (
                  <td
                    key={key}
                    className="px-3.5 py-3.5 text-left"
                    style={{
                      background: key === current ? HIGHLIGHT : undefined,
                    }}
                  >
                    <ColumnCta
                      column={key}
                      current={current}
                      signInHref={signInHref}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className="mt-5 grid gap-4 text-sm leading-normal sm:grid-cols-2"
          style={{ color: "var(--t-ink-dim)" }}
        >
          <p className="m-0 flex gap-2">
            <Icon name="check" size={18} color={T.accent.ok} />
            <span>
              <strong style={{ color: T.ink.base }}>
                {m("sheet.reachTitle", values)}
              </strong>{" "}
              {m("sheet.reachBody", values)}{" "}
              <GlobalLink
                href="/plans"
                {...analyticsAttributes("membership_interest", {
                  interaction_source: "upgrade_prompt",
                  action_type: "compare",
                })}
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                {m("sheet.allPlans")}
              </GlobalLink>
            </span>
          </p>
          <p className="m-0 flex gap-2">
            <Icon name="globe" size={18} color="var(--t-palette-violet-fg)" />
            <span>
              <strong style={{ color: T.ink.base }}>
                {m("sheet.openTitle")}
              </strong>{" "}
              {m("sheet.openBody")}
            </span>
          </p>
        </div>
      </div>
    </Drawer>
  )
}
