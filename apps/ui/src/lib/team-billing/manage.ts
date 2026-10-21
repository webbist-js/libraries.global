import "server-only"

import type { Pool } from "pg"
import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { withBillingLock } from "@/lib/billing/database"
import { stripeId } from "@/lib/billing/provider"

import { teamContext, type TeamBillingAccount } from "./billing"
import { teamBillingBridge } from "./bridge"
import { teamBillingConfig } from "./config"
import { refreshTeamSubscription, syncTeamMembership } from "./sync"

type Buyer = { id: string; email: string; name?: string | null }

export async function refreshOwnedTeam(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  buyer: Buyer
) {
  const context = await teamContext(teamId, buyer)
  const account = (
    await pool.query<{ current_subscription_id: string | null }>(
      "select current_subscription_id from team_billing_accounts where id=$1 and team_id=$2 and mode=$3",
      [context.accountId, teamId, teamBillingConfig().mode]
    )
  ).rows[0]
  if (!account) throw new BillingError("team_billing_not_found", 404)
  const attempt = (
    await pool.query<{ session_id: string }>(
      "select session_id from team_billing_attempts where account_id=$1 and state='open' and session_id is not null",
      [context.accountId]
    )
  ).rows[0]
  let id = account.current_subscription_id
  if (attempt) {
    const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
    if (session.status === "complete") id = stripeId(session.subscription)
  }
  if (id) {
    await refreshTeamSubscription(pool, stripe, id)
    const row = (
      await pool.query(
        "select m.*,a.team_id from team_billing_memberships m join team_billing_accounts a on a.current_subscription_id=m.subscription_id where a.id=$1",
        [context.accountId]
      )
    ).rows[0]
    if (row) await syncTeamMembership(pool, row)
  }

  return { ok: true }
}

async function expireUnsettledCheckout(stripe: Stripe, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.status === "complete")
    throw new BillingError("team_payment_confirmation_pending", 409)
  if (session.status === "open")
    await stripe.checkout.sessions.expire(session.id)
}

export async function discardTeam(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  buyer: Buyer
) {
  const context = await teamContext(teamId, buyer)

  // Share the API checkout lock so discard cannot race a new add-on payment.
  return withBillingLock(pool, `api-team:${teamId}`, () =>
    withBillingLock(
      pool,
      `team-billing:${context.accountId}`,
      async (client) => {
        const account = (
          await client.query<TeamBillingAccount>(
            "select * from team_billing_accounts where id=$1 and team_id=$2 and mode=$3",
            [context.accountId, teamId, teamBillingConfig().mode]
          )
        ).rows[0]
        if (!account) throw new BillingError("team_billing_not_found", 404)
        const uncertain = await client.query(
          "select 1 from team_billing_attempts where account_id=$1 and state='preparing'",
          [account.id]
        )
        if (
          uncertain.rowCount ||
          (account.customer_started_at && !account.customer_id)
        )
          throw new BillingError("team_checkout_needs_reconciliation", 409)
        if (account.customer_id) {
          const subs = await stripe.subscriptions.list({
            customer: account.customer_id,
            status: "all",
            limit: 100,
          })
          if (
            subs.has_more ||
            subs.data.some(
              (sub) => !["canceled", "incomplete_expired"].includes(sub.status)
            )
          )
            throw new BillingError("cancel_team_before_discard", 409)
        }
        const api = await client.query(
          "select 1 from team_api_memberships where team_id=$1 and (snapshot->>'status') not in ('canceled','incomplete_expired') limit 1",
          [teamId]
        )
        if (api.rowCount)
          throw new BillingError("cancel_api_before_discard", 409)
        const attempts = await client.query<{ id: string; session_id: string }>(
          "select id,session_id from team_billing_attempts where account_id=$1 and state='open'",
          [account.id]
        )
        for (const attempt of attempts.rows) {
          await expireUnsettledCheckout(stripe, attempt.session_id)
          await client.query(
            "update team_billing_attempts set state='expired',checkout_url=null where id=$1",
            [attempt.id]
          )
        }
        const apiAttempts = await client.query<{
          id: string
          session_id: string | null
          state: string
        }>(
          "select id,session_id,state from team_api_attempts where team_id=$1 and state in ('preparing','open')",
          [teamId]
        )
        for (const attempt of apiAttempts.rows) {
          if (!attempt.session_id || attempt.state === "preparing")
            throw new BillingError("team_checkout_needs_reconciliation", 409)
          await expireUnsettledCheckout(stripe, attempt.session_id)
          await client.query(
            "update team_api_attempts set state='expired',checkout_url=null where id=$1",
            [attempt.id]
          )
        }
        const result = await teamBillingBridge("discard", {
          teamId,
          accountId: account.id,
          baUserId: buyer.id,
        })
        await client.query(
          "update team_billing_accounts set archived_at=now() where id=$1",
          [account.id]
        )
        await client.query(
          "update team_api_keys set revoked_at=coalesce(revoked_at,now()) where team_id=$1",
          [teamId]
        )

        return result
      }
    )
  )
}

/** Called under the same user lock as signup, before identity/profile erasure. */
export async function guardTeamBillingDeletion(pool: Pool, userId: string) {
  const pending = await pool.query(
    "select 1 from team_billing_accounts where creator_id=$1 and team_id is null and archived_at is null limit 1",
    [userId]
  )
  if (pending.rowCount)
    throw new BillingError("team_signup_needs_reconciliation", 409)
  await teamBillingBridge("deletionCheck", { baUserId: userId })
  await pool.query(
    "insert into team_billing_erasing_users(user_id) values($1) on conflict do nothing",
    [userId]
  )
}
