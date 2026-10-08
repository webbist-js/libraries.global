import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { planStatusCopy } from "@/lib/plans"

/** The second line: why there's nothing to pay, and how it keeps going. */
const DETAIL: Record<string, string> = {
  grant: "It’s complimentary, so there’s nothing to pay.",
  earned:
    "It’s complimentary, so there’s nothing to pay. Stay at Archivist and it renews by itself.",
  verified:
    "It’s complimentary, so there’s nothing to pay. It renews each year.",
  team: "Your library service pays for the Team; its organiser manages the seats.",
}

const ACTION: Record<string, { label: string; href: string }> = {
  earned: { label: "See your contributions", href: "/contribute/submissions" },
  team: { label: "Open the Staff area", href: "/staff" },
}

/** How the member holds Pro or Team. Renders nothing for free and public. */
export function PlanStatusBanner({
  plan,
  planSource,
}: {
  readonly plan?: string | null
  readonly planSource?: string | null
}) {
  const copy = planStatusCopy(plan, planSource)
  if (!copy) return null
  const detail = planSource ? DETAIL[planSource] : undefined
  const action = (planSource && ACTION[planSource]) || {
    label: "Open the Atlas",
    href: "/map",
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] border px-5 py-4"
      style={{
        background: T.accent.chip,
        borderColor:
          "color-mix(in srgb, var(--t-accent-primary) 25%, transparent)",
        color: T.ink.base,
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: T.bg.deep, color: T.accent.primary }}
      >
        <Icon height={20} icon="mdi:check" width={20} />
      </span>
      <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
        <p className="m-0 text-[16px] font-semibold">{copy}</p>
        {detail ? (
          <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
            {detail}
          </p>
        ) : null}
      </div>
      <GlobalLink
        className="inline-flex h-10 items-center rounded-full border bg-white px-4 text-[14.5px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
        href={action.href}
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        {action.label}
      </GlobalLink>
    </div>
  )
}
