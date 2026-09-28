import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import type { PlanInclude } from "@/lib/plans"

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
      className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-semibold"
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
      <span className="flex flex-col gap-1">
        {includeLabel(item)}
        {soon ? <ComingSoonChip /> : null}
      </span>
    </li>
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
        <h2 id={id} className="m-0" style={H2_STYLE}>
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
