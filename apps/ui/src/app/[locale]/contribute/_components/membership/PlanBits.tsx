import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import type { PlanCard, PlanInclude } from "@/lib/plans"

const SOON_SUFFIX = " (coming soon)"

/** An include's text without its "(coming soon)" suffix; the chip says it. */
export function includeLabel(item: PlanInclude): string {
  return item.text.endsWith(SOON_SUFFIX)
    ? item.text.slice(0, -SOON_SUFFIX.length)
    : item.text
}

export function ComingSoonChip({ label = "Coming soon" }: { label?: string }) {
  return (
    <span
      className="ml-1 inline-flex w-fit items-center rounded-full px-2 py-px align-[1px] text-[12px] leading-[1.4] font-semibold whitespace-nowrap"
      style={{ background: T.bg.muted, color: T.ink.dim }}
    >
      {label}
    </span>
  )
}

/** A built include gets a green tick; an unbuilt one a clock and a chip. */
export function IncludeItem({ item }: { readonly item: PlanInclude }) {
  const soon = item.kind === "soon"

  return (
    <li
      className="flex gap-2 text-[14.5px] leading-[1.45]"
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
        {includeLabel(item)}
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
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white"
      style={{ background: T.accent.primary }}
    >
      <Icon aria-hidden="true" height={14} icon="mdi:check" width={14} />
      Your plan
    </span>
  )
}

export function PlanFeatures({
  plan,
  children,
}: {
  readonly plan: PlanCard
  readonly children?: ReactNode
}) {
  const live = plan.includes.filter((item) => item.kind === "feature")
  const notes = plan.includes.filter((item) => item.kind === "note")

  return (
    <div
      className="flex flex-col gap-3 border-t pt-5"
      style={{ borderColor: T.border.divider }}
    >
      <p className="m-0 text-[13.5px] font-bold">Included now</p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {live.map((item) => (
          <IncludeItem key={item.text} item={item} />
        ))}
      </ul>
      {notes.map((item) => (
        <p
          key={item.text}
          className="m-0 rounded-[14px] border px-3.5 py-2.5 text-[13.5px] leading-[1.5]"
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
  fontFamily: T.font.serif,
  fontSize: "clamp(28px,3.2vw,36px)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.1,
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
        <h2 id={id} className="m-0 scroll-mt-24" style={H2_STYLE}>
          {title}
        </h2>
        <p
          className="mt-2 mb-0 max-w-[62ch] text-[16px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {sub}
        </p>
      </div>
      {control}
    </div>
  )
}
