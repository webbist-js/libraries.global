import type { PlanKey } from "@repo/access"
import { useTranslations as useUiTranslations } from "next-intl"

import { Badge } from "./Badge"

/**
 * The plan behind a staff area: "Team plan" (indigo) when the library is
 * covered by a Team, else "Staff access · free" (neutral). `covered` wins
 * over `plan`, so a library-scoped check can drive it. Neither carries an
 * icon: the lock belongs to the gated tabs' "Team" tags, not the plan.
 */
export function PlanChip({
  plan,
  covered,
}: {
  readonly plan: PlanKey
  readonly covered?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const team = covered ?? plan === "team"

  return (
    <Badge
      label={team ? tUi("team_plan") : "Staff access · free"}
      color={team ? "aurora" : "dim"}
    />
  )
}
