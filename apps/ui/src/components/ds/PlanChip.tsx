import type { PlanKey } from "@repo/access"

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
  const team = covered ?? plan === "team"

  return (
    <Badge
      label={team ? "Team plan" : "Staff access · free"}
      color={team ? "aurora" : "dim"}
    />
  )
}
