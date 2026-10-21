import "server-only"

import { isDeepStrictEqual } from "node:util"

import type { Pool } from "pg"
import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { withBillingLock } from "@/lib/billing/database"
import { isManagedCheckout, stripeId } from "@/lib/billing/provider"
import { invalidateSessionProfile } from "@/lib/session-profile"

import type { TeamBillingAccount, TeamCheckoutAttempt } from "./billing"
import { teamBillingBridge } from "./bridge"
import { teamBillingConfig } from "./config"
import { projectTeamMembership } from "./projection"
import type { TeamMembership } from "./types"

type MembershipRow = {
  subscription_id: string
  account_id: string
  snapshot: TeamMembership
  revision: string
  team_id: string
  synced_revision: string
}

export async function refreshTeamSubscription(
  pool: Pool,
  stripe: Stripe,
  id: string,
  reversal?: { revoke: boolean; reversedInvoice?: string }
) {
  const binding = await stripe.subscriptions.retrieve(id)
  const accountId = binding.metadata.lg_team_billing_id
  if (!accountId || !/^[\da-f-]{36}$/i.test(accountId)) return false

  return withBillingLock(pool, `team-billing:${accountId}`, async (client) => {
    // Read provider state under the account lock so an older concurrent fetch
    // cannot overwrite a newer paid projection. The first read only finds its lock.
    const subscription = await stripe.subscriptions.retrieve(id, {
      expand: ["latest_invoice", "schedule.phases.items.price"],
    })
    const config = teamBillingConfig()
    const account = (
      await client.query<
        TeamBillingAccount & { current_subscription_id: string | null }
      >(
        "select * from team_billing_accounts where id=$1 and archived_at is null",
        [accountId]
      )
    ).rows[0]
    if (!account) return false
    if (
      subscription.metadata.lg_team_billing_id !== account.id ||
      account.mode !== config.mode ||
      subscription.livemode !== (config.mode === "live") ||
      stripeId(subscription.customer) !== account.customer_id ||
      subscription.metadata.lg_team_id !== account.team_id
    )
      throw new BillingError("team_subscription_binding_invalid")
    const attempt = (
      await client.query<TeamCheckoutAttempt>(
        "select * from team_billing_attempts where id::text=$1 and account_id=$2",
        [subscription.metadata.lg_team_attempt_id ?? "", account.id]
      )
    ).rows[0]
    if (!attempt?.session_id)
      throw new BillingError("team_subscription_binding_pending")
    const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
    if (
      !isManagedCheckout(session) ||
      session.status !== "complete" ||
      session.mode !== "subscription" ||
      session.livemode !== subscription.livemode ||
      stripeId(session.subscription) !== id ||
      stripeId(session.customer) !== account.customer_id ||
      session.client_reference_id !== account.id ||
      session.metadata?.lg_team_billing_id !== account.id ||
      session.metadata?.lg_team_id !== account.team_id ||
      session.metadata?.lg_team_attempt_id !== attempt.id
    )
      throw new BillingError("team_subscription_binding_invalid")
    if (
      account.current_subscription_id &&
      account.current_subscription_id !== id
    ) {
      const current = (
        await client.query<{ created_at: Date }>(
          "select created_at from team_billing_attempts where subscription_id=$1",
          [account.current_subscription_id]
        )
      ).rows[0]
      // Late events for an earlier subscription cannot lapse a replacement.
      if (!current || current.created_at >= attempt.created_at) return true
    }
    const previous =
      (
        await client.query<{ snapshot: TeamMembership }>(
          "select snapshot from team_billing_memberships where subscription_id=$1",
          [id]
        )
      ).rows[0]?.snapshot ?? null
    const invoices: Stripe.Invoice[] = []
    // Bound provider work, but never use a truncated invoice to prove seats.
    const paid = await stripe.invoices.list({
      subscription: id,
      status: "paid",
      limit: 30,
    })
    invoices.push(...paid.data)
    const snapshot = projectTeamMembership(
      subscription,
      invoices,
      previous,
      attempt.price_id
    )
    if (
      reversal?.revoke &&
      invoices.some(
        (invoice) =>
          invoice.id === reversal.reversedInvoice &&
          invoice.lines.data.some(
            (line) =>
              new Date(line.period.end * 1000).toISOString() ===
              snapshot.paidThrough
          )
      )
    ) {
      snapshot.revoked = true
      snapshot.accessUntil = null
    }
    if (
      !isDeepStrictEqual(previous, snapshot) ||
      account.current_subscription_id !== id
    ) {
      const version = (
        await client.query<{ revision: string }>(
          "update team_billing_accounts set revision=revision+1,current_subscription_id=$2 where id=$1 returning revision",
          [account.id, id]
        )
      ).rows[0]!.revision
      await client.query(
        "insert into team_billing_memberships(subscription_id,account_id,snapshot,revision) values($1,$2,$3,$4) on conflict(subscription_id) do update set snapshot=excluded.snapshot,revision=excluded.revision,next_sync_at=now(),sync_attempts=0,reconciled_at=now()",
        [id, account.id, snapshot, version]
      )
    }
    await client.query(
      "update team_billing_memberships set reconciled_at=now() where subscription_id=$1",
      [id]
    )
    await client.query(
      "update team_billing_attempts set state='complete',subscription_id=$2,checkout_url=null where id=$1",
      [attempt.id, id]
    )

    return true
  })
}

export async function syncTeamMembership(pool: Pool, row: MembershipRow) {
  if (row.snapshot.mode !== teamBillingConfig().mode)
    throw new BillingError("billing_environment_mismatch")
  const result = await teamBillingBridge<{
    userIds: string[]
    capacityBlocked: boolean
  }>("sync", {
    accountId: row.account_id,
    teamId: row.team_id,
    revision: Number(row.revision),
    membership: row.snapshot,
  })
  if (result.capacityBlocked) throw new BillingError("team_seats_occupied", 409)
  await pool.query(
    "update team_billing_memberships set synced_revision=greatest(synced_revision,$2),sync_attempts=0,next_sync_at=now() where subscription_id=$1",
    [row.subscription_id, Number(row.revision)]
  )
  result.userIds.forEach((userId) => invalidateSessionProfile(userId))
}

async function reconcileOpenCheckout(
  pool: Pool,
  stripe: Stripe,
  attempt: { id: string; session_id: string }
) {
  const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
  const id = stripeId(session.subscription)
  if (session.status === "complete" && id)
    await refreshTeamSubscription(pool, stripe, id)
  if (session.status === "expired")
    await pool.query(
      "update team_billing_attempts set state='expired',checkout_url=null where id=$1",
      [attempt.id]
    )
}

/** Recovery keeps running when new Team purchases are disabled. */
export async function reconcileTeamBilling(
  pool: Pool,
  stripe: Stripe,
  withinBudget: () => boolean
) {
  let failed = 0
  const attempts = await pool.query<{ id: string; session_id: string }>(
    "select id,session_id from team_billing_attempts where state='open' and session_id is not null order by reconciled_at limit 10"
  )
  for (const attempt of attempts.rows) {
    if (!withinBudget()) break
    try {
      await reconcileOpenCheckout(pool, stripe, attempt)
    } catch {
      failed++
    }
    await pool.query(
      "update team_billing_attempts set reconciled_at=now() where id=$1",
      [attempt.id]
    )
  }
  const stale = await pool.query<{ subscription_id: string }>(
    "select m.subscription_id from team_billing_memberships m join team_billing_accounts a on a.current_subscription_id=m.subscription_id where a.archived_at is null and m.reconciled_at<now()-interval '15 minutes' order by m.reconciled_at limit 10"
  )
  for (const row of stale.rows) {
    if (!withinBudget()) break
    try {
      await refreshTeamSubscription(pool, stripe, row.subscription_id)
    } catch {
      failed++
      await pool.query(
        "update team_billing_memberships set reconciled_at=now() where subscription_id=$1",
        [row.subscription_id]
      )
    }
  }
  const pending = await pool.query<MembershipRow>(
    "select m.*,a.team_id from team_billing_memberships m join team_billing_accounts a on a.id=m.account_id and a.current_subscription_id=m.subscription_id where a.archived_at is null and m.synced_revision<m.revision and m.next_sync_at<=now() order by m.next_sync_at limit 20"
  )
  for (const row of pending.rows) {
    if (!withinBudget()) break
    try {
      await syncTeamMembership(pool, row)
    } catch {
      failed++
      await pool.query(
        "update team_billing_memberships set sync_attempts=sync_attempts+1,next_sync_at=now()+(least(3600,30*power(2,least(sync_attempts,7)))*interval '1 second') where subscription_id=$1",
        [row.subscription_id]
      )
    }
  }

  return failed
}
