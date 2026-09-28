import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import type { CompareCell } from "@/lib/plan-compare"

/** One plan × feature cell: a tick, a "Soon" chip, or a dash (all labelled). */
export function PlanCompareCell({ cell }: { readonly cell: CompareCell }) {
  if (cell === "yes")
    return (
      <span className="inline-flex" style={{ color: T.accent.ok }}>
        <Icon aria-hidden="true" height={17} icon="mdi:check" width={17} />
        <span className="sr-only">Included</span>
      </span>
    )

  if (cell === "soon")
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap"
        style={{ background: T.accent.chip, color: T.accent.primaryHover }}
      >
        <Icon
          aria-hidden="true"
          height={12}
          icon="mdi:clock-outline"
          width={12}
        />
        Soon
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
