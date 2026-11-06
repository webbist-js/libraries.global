import "server-only"

import type { Pool } from "pg"

import { organiserTeams } from "@/lib/team-api/cms"

import { BillingError, billingConfig } from "./config"
import { withBillingLock } from "./database"
import { billingStripe } from "./provider"

/**
 * Must run on every erasure entry point before profile or identity is
 * removed. API accounts belong to organisations:
 *
 * - another organiser keeps the account running: nothing to stop;
 * - other members but no other organiser: refuse until ownership moves;
 * - the account holder is alone: cancel its subscription now, expire open
 *   checkouts and revoke its keys before erasure.
 */
export async function stopBillingBeforeDeletion(pool: Pool, userId: string) {
  let teams
  try {
    teams = await organiserTeams(userId)
  } catch {
    throw new BillingError("stop_api_billing_before_deletion", 503)
  }
  for (const team of teams) {
    if (team.otherOrganisers > 0) continue
    try {
      await withBillingLock(
        pool,
        `api-account:${team.teamId}`,
        async (client) => {
          const account = (
            await client.query<{ customer_id: string | null; mode: string }>(
              "select customer_id,mode from api_accounts where team_id=$1",
              [team.teamId]
            )
          ).rows[0]
          if (!account) return
          if (team.otherMembers > 0)
            throw new BillingError("transfer_api_account_before_deletion", 409)
          if (account.mode !== billingConfig().mode)
            throw new BillingError("billing_environment_mismatch")
          const uncertain = await client.query(
            "select 1 from api_attempts where team_id=$1 and state='preparing' limit 1",
            [team.teamId]
          )
          // A timed-out provider call may have created a payable session whose
          // id is not yet persisted; reconcile that attempt before erasure.
          if (uncertain.rowCount)
            throw new BillingError("checkout_needs_reconciliation")
          if (account.customer_id) {
            const stripe = billingStripe()
            for await (const subscription of stripe.subscriptions.list({
              customer: account.customer_id,
              status: "all",
              limit: 100,
            }))
              if (
                !["canceled", "incomplete_expired"].includes(
                  subscription.status
                )
              )
                await stripe.subscriptions.cancel(subscription.id)
            const attempts = await client.query<{ session_id: string }>(
              "select session_id from api_attempts where team_id=$1 and state='open' and session_id is not null",
              [team.teamId]
            )
            for (const attempt of attempts.rows) {
              const session = await stripe.checkout.sessions.retrieve(
                attempt.session_id
              )
              if (session.status === "open")
                await stripe.checkout.sessions.expire(session.id)
            }
          }
          await client.query(
            "update api_attempts set checkout_url=null,state=case when state='complete' then state else 'expired' end where team_id=$1",
            [team.teamId]
          )
          await client.query(
            "update api_keys set revoked_at=coalesce(revoked_at,now()) where team_id=$1",
            [team.teamId]
          )
          // Financial records stay; the account cannot buy or call again.
          await client.query(
            "update api_accounts set closed_at=coalesce(closed_at,now()),overage_enabled=false where team_id=$1",
            [team.teamId]
          )
        }
      )
    } catch (error) {
      if ((error as { code?: string }).code === "42P01") continue // Never deployed.
      if (
        error instanceof BillingError &&
        [
          "transfer_api_account_before_deletion",
          "checkout_needs_reconciliation",
        ].includes(error.code)
      )
        throw error
      throw new BillingError("stop_api_billing_before_deletion", 503)
    }
  }
}
