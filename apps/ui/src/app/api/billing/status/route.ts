import type { PaidMembership } from "@repo/access"

import { authDbPool } from "@/lib/auth"
import { BillingError, billingConfig } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { invalidateSessionProfile } from "@/lib/session-profile"

export const runtime = "nodejs"
export async function GET(req: Request) {
  try {
    const user = await billingUser(req)
    const id = new URL(req.url).searchParams.get("attempt")
    if (!id || !/^[\da-f-]{36}$/i.test(id))
      throw new BillingError("checkout_not_found", 404)
    const attempt = await authDbPool.query<{ state: string }>(
      "select state from billing_attempts where id::text=$1 and user_id=$2",
      [id, user.id]
    )
    if (!attempt.rows[0]) throw new BillingError("checkout_not_found", 404)
    const result = await authDbPool.query<{
      snapshot: PaidMembership
      revision: string
      synced_revision: string
    }>(
      "select m.snapshot,m.revision,m.synced_revision from billing_memberships m join billing_attempts a on a.subscription_id=m.subscription_id where a.id::text=$1 and m.user_id=$2 and a.user_id=$2",
      [id, user.id]
    )
    const row = result.rows[0]
    const paid =
      row &&
      row.snapshot.mode === billingConfig().mode &&
      row.snapshot.status === "active" &&
      !row.snapshot.revoked &&
      row.snapshot.paidThrough &&
      Date.parse(row.snapshot.paidThrough) > Date.now()
    const ready = Boolean(paid && row.synced_revision === row.revision)
    if (ready) invalidateSessionProfile(user.id)

    return billingJson({
      state: ready
        ? "ready"
        : attempt.rows[0].state === "expired"
          ? "expired"
          : paid
            ? "sync_pending"
            : "processing",
      membership: ready ? row?.snapshot : null,
    })
  } catch (error) {
    return billingFailure(error)
  }
}
