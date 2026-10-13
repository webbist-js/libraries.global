import "server-only"

import { isPaidMembership } from "@repo/access"
import type { Pool } from "pg"

import { billingConfig } from "./config"

/** The purchase page sends existing subscribers to their owned billing controls. */
export async function hasManagedMembership(pool: Pool, userId: string) {
  let result
  try {
    result = await pool.query<{ snapshot: unknown }>(
      "select m.snapshot from billing_memberships m join billing_accounts a on a.user_id=m.user_id where m.user_id=$1 and a.mode=$2 and a.erased_at is null limit 100",
      [userId, billingConfig().mode]
    )
  } catch (error) {
    // A configured key can precede the explicit billing migration.
    if ((error as { code?: string }).code === "42P01") return false
    throw error
  }

  return result.rows.some(
    ({ snapshot }) =>
      isPaidMembership(snapshot) &&
      snapshot.mode === billingConfig().mode &&
      (!["canceled", "incomplete_expired"].includes(snapshot.status) ||
        Boolean(
          snapshot.paidThrough && Date.parse(snapshot.paidThrough) > Date.now()
        ))
  )
}
