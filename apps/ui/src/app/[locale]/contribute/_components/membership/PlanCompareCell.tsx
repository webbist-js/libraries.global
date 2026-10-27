import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { useMembershipContent } from "@/lib/localized-plans"
import type { CompareCell } from "@/lib/plan-compare"

/** One plan × feature cell: a tick, a "Soon" chip, or a dash (all labelled). */
export function PlanCompareCell({
  cell,
  label,
  isExport = false,
}: {
  readonly cell: CompareCell
  readonly isExport?: boolean
  readonly label?: string
}) {
  const m = useMembershipContent()
  const tUi = useUiTranslations("ui")

  if (cell === "yes" && label)
    return (
      <span className="font-semibold">
        {label}
        {isExport ? (
          <span className="sr-only"> {m("copy.perDownload")}</span>
        ) : null}
      </span>
    )

  if (cell === "yes")
    return (
      <span className="inline-flex" style={{ color: T.accent.ok }}>
        <Icon aria-hidden="true" height={17} icon="mdi:check" width={17} />
        <span className="sr-only">{m("copy.included")}</span>
      </span>
    )

  if (cell === "soon")
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
        style={{ background: T.accent.chip, color: T.accent.primaryHover }}
      >
        <Icon
          aria-hidden="true"
          height={12}
          icon="mdi:clock-outline"
          width={12}
        />
        {tUi("soon")}
        <span className="sr-only">: {m("copy.soon")}</span>
      </span>
    )

  return (
    <span style={{ color: "#8A8799" }}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{m("copy.notIncluded")}</span>
    </span>
  )
}
