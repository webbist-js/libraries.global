import "server-only"

import type { Pool } from "pg"

import { BillingError, billingConfig } from "./config"
import { withBillingLock } from "./database"
import { billingStripe } from "./provider"

/** Must run on every erasure entry point before profile or identity is removed. */
export async function stopBillingBeforeDeletion(pool: Pool, userId: string) {
  try {
    await withBillingLock(pool, `user:${userId}`, async (client) => {
      const accounts = await client.query<{
        customer_id: string | null
        erased_at: Date | null
        mode: string
      }>(
        "select customer_id,erased_at,mode from billing_accounts where user_id=$1",
        [userId]
      )
      const account = accounts.rows[0]
      if (!account || account.erased_at) return
      if (account.mode !== billingConfig().mode)
        throw new BillingError("billing_environment_mismatch")
      const uncertain = await client.query(
        "select 1 from billing_attempts where user_id=$1 and state='preparing' limit 1",
        [userId]
      )
      // Recover the same idempotent attempt before erasure; a timed-out provider
      // call may have created a payable session whose id is not yet persisted.
      if (uncertain.rowCount)
        throw new BillingError("checkout_needs_reconciliation")
      await client.query(
        "update billing_accounts set deleting=true where user_id=$1",
        [userId]
      )
      if (account.customer_id) {
        const stripe = billingStripe()
        for await (const subscription of stripe.subscriptions.list({
          customer: account.customer_id,
          status: "all",
          limit: 100,
        })) {
          if (!["canceled", "incomplete_expired"].includes(subscription.status))
            await stripe.subscriptions.cancel(subscription.id)
        }
        const attempts = await client.query<{ session_id: string }>(
          "select session_id from billing_attempts where user_id=$1 and state='open'",
          [userId]
        )
        for (const attempt of attempts.rows) {
          const session = await stripe.checkout.sessions.retrieve(
            attempt.session_id
          )
          if (session.status === "open")
            await stripe.checkout.sessions.expire(session.id)
        }
      }
      // Keep a minimal financial tombstone, not login/contact/profile data. A late
      // provider event cannot recreate the erased account or its paid entitlement.
      await client.query(
        "update billing_accounts set erased_at=now() where user_id=$1",
        [userId]
      )
      await client.query(
        "update billing_memberships set snapshot=jsonb_set(snapshot,'{revoked}','true'::jsonb),revision=revision+1 where user_id=$1",
        [userId]
      )
      await client.query(
        "update billing_attempts set checkout_url=null,state=case when state='complete' then state else 'expired' end where user_id=$1",
        [userId]
      )
    })
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return // Billing has never been deployed.
    throw new BillingError("cancel_membership_before_deletion", 503)
  }
}
