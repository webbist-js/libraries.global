import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { useMembershipContent } from "@/lib/localized-plans"
import type { OfferItem } from "@/lib/plans"

/** One translated line of an offer's list. */
export type IncludeLine = Pick<OfferItem, "status"> & { text: string }

export function ComingSoonChip({ label }: { label?: string }) {
  const m = useMembershipContent()

  return (
    <span
      className="ml-1 inline-flex w-fit items-center rounded-full px-2 py-px align-[1px] text-xs leading-[1.4] font-semibold whitespace-nowrap"
      style={{ background: T.bg.muted, color: T.ink.dim }}
    >
      {label ?? m("copy.soon")}
    </span>
  )
}

/** A built include gets a green tick; a planned one a clock and a chip. */
export function IncludeItem({ item }: { readonly item: IncludeLine }) {
  const soon = item.status === "soon"

  return (
    <li
      className="flex gap-2 text-sm leading-[1.45]"
      style={{ color: soon ? T.ink.dim : T.ink.base }}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        height={16}
        icon={soon ? "mdi:clock-outline" : "mdi:check"}
        style={{ color: soon ? T.ink.dim : T.accent.ok }}
        width={16}
      />
      <span>
        {item.text}
        {soon ? (
          <>
            {" "}
            <ComingSoonChip />
          </>
        ) : null}
      </span>
    </li>
  )
}

export function CurrentPlanBadge() {
  const m = useMembershipContent()

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold text-white"
      style={{ background: T.action.primary }}
    >
      <Icon aria-hidden="true" height={14} icon="mdi:check" width={14} />
      {m("copy.current")}
    </span>
  )
}

/** An offer's list: what's included (built and planned), then its notes. */
export function PlanFeatures({
  items,
  children,
}: {
  readonly items: readonly IncludeLine[]
  readonly children?: ReactNode
}) {
  const m = useMembershipContent()
  const included = items.filter((item) => item.status !== "note")
  const notes = items.filter((item) => item.status === "note")

  return (
    <div
      className="flex flex-col gap-3 border-t pt-5"
      style={{ borderColor: T.border.divider }}
    >
      <p className="m-0 text-sm font-bold">{m("copy.includes")}</p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {included.map((item) => (
          <IncludeItem key={item.text} item={item} />
        ))}
      </ul>
      {notes.map((item) => (
        <p
          key={item.text}
          className="m-0 rounded-[14px] border px-3.5 py-2.5 text-sm leading-[1.5]"
          style={{
            background: T.bg.surface,
            borderColor: T.border.line,
            color: T.ink.dim,
          }}
        >
          {item.text}
        </p>
      ))}
      {children}
    </div>
  )
}
export const H2_STYLE = {
  color: T.ink.base,
} as const

/** Section heading with a dim line under it, and an optional control on the right. */
export function PlanSectionHeader({
  id,
  title,
  sub,
  control,
}: {
  readonly id: string
  readonly title: string
  readonly sub: ReactNode
  readonly control?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className="type-h2 m-0 scroll-mt-24" style={H2_STYLE}>
          {title}
        </h2>
        <p
          className="mt-2 mb-0 max-w-[62ch] text-base leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {sub}
        </p>
      </div>
      {control}
    </div>
  )
}
