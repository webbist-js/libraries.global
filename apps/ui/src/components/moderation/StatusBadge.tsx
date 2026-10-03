import { Badge } from "@/components/ds"

import { statusMeta } from "./submissionMeta"

/** A Submission State as colour, icon and text together. */
export function StatusBadge({ status }: { readonly status: string }) {
  const meta = statusMeta(status)

  return <Badge label={meta.label} color={meta.color} icon={meta.icon} />
}
