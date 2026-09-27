import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { planStatusCopy } from "@/lib/plans"

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

  return (
    <div
      className="flex items-start gap-3 rounded-[20px] px-5 py-4"
      style={{ background: T.accent.chip, color: T.ink.base }}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        height={22}
        icon="mdi:check-decagram"
        style={{ color: T.accent.primary }}
        width={22}
      />
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[16px] font-semibold">{copy}</p>
        {planSource === "paid" ? null : (
          <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
            It’s complimentary, so there’s nothing to pay.
          </p>
        )}
      </div>
    </div>
  )
}
