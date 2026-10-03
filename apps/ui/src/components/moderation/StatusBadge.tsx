import { Icon } from "@iconify/react"

import { Badge } from "@/components/ds"

import { statusMeta } from "./submissionMeta"

/** A Submission State as colour, icon and text together. */
export function StatusBadge({ status }: { readonly status: string }) {
  const meta = statusMeta(status)

  return (
    <span className="inline-flex items-center gap-1">
      <Icon
        aria-hidden="true"
        icon={meta.icon}
        width={16}
        height={16}
        style={{ color: "currentColor" }}
      />
      <Badge label={meta.label} color={meta.color} />
    </span>
  )
}
