import "server-only"

import { isDeepStrictEqual } from "node:util"

import type { PaidMembership } from "@repo/access"
import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"

import { invalidateSessionProfile } from "@/lib/session-profile"
import {
  refreshApiSubscription,
  reconcileApiBilling,
} from "@/lib/team-api/billing"
import { maintainApiUsage } from "@/lib/team-api/store"

import { BillingError, billingConfig } from "./config"
import { withBillingLock } from "./database"
import { invoiceSubscription, projectMembership } from "./projection"
import { isManagedCheckout, stripeId } from "./provider"

export const BILLING_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.marked_uncollectible",
  "invoice.voided",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "refund.updated",
  "subscription_schedule.created",
  "subscription_schedule.updated",
  "subscription_schedule.canceled",
  "subscription_schedule.released",
  "subscription_schedule.completed",
  "subscription_schedule.aborted",
])
type EventRow = {
  event_id: string
  event_type: string
  object_id: string
  attempts: number
}
type MembershipRow = {
  subscription_id: string
  user_id: string
  snapshot: PaidMembership
  revision: string
  synced_revision: string
}

/** Persist only references, not raw webhook bodies containing personal data. */
export async function receiveBillingEvent(pool: Pool, event: Stripe.Event) {
  if (event.livemode !== (billingConfig().mode === "live") || event.account)
    throw new BillingError("webhook_environment_mismatch", 400)
  if (!BILLING_EVENTS.has(event.type)) return
  const object = event.data.object as { id?: unknown }
  if (typeof object.id !== "string")
    throw new BillingError("webhook_object_invalid", 400)
  const id = object.id
  await pool.query(
    "insert into billing_events(event_id,event_type,object_id) values($1,$2,$3) on conflict do nothing",
    [event.id, event.type, id]
  )
}

async function eventSubscription(stripe: Stripe, event: EventRow) {
  if (event.event_type.startsWith("subscription_schedule.")) {
    const schedule = await stripe.subscriptionSchedules.retrieve(
      event.object_id
    )

    return {
      id: stripeId(schedule.subscription ?? schedule.released_subscription),
      revoke: false,
    }
  }
  if (event.event_type.startsWith("customer.subscription."))
    return { id: event.object_id, revoke: false }
  if (event.event_type.startsWith("checkout.session.")) {
    const session = await stripe.checkout.sessions.retrieve(event.object_id)
    if (!isManagedCheckout(session)) return null

    return { id: stripeId(session.subscription), revoke: false }
  }
  if (event.event_type.startsWith("invoice.")) {
    const invoice = await stripe.invoices.retrieve(event.object_id)

    return { id: invoiceSubscription(invoice), revoke: false }
  }
  let chargeId: string | null = event.object_id
  let revoke = false
  if (event.event_type.startsWith("charge.dispute.")) {
    const dispute = await stripe.disputes.retrieve(event.object_id)
    chargeId = stripeId(dispute.charge)
    // A won dispute does not automatically undo an operator/refund revocation.
    revoke = dispute.status !== "won"
  } else if (event.event_type === "refund.updated") {
    const refund = await stripe.refunds.retrieve(event.object_id)
    chargeId = stripeId(refund.charge)
  }
  if (!chargeId) return null
  const charge = await stripe.charges.retrieve(chargeId)
  const intent = stripeId(charge.payment_intent)
  if (!intent) return null
  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: intent },
    limit: 10,
  })
  const invoiceId = stripeId(payments.data[0]?.invoice)
  if (!invoiceId) return null
  const invoice = await stripe.invoices.retrieve(invoiceId)
  const refunded = charge.refunded && charge.amount_refunded >= charge.amount

  return {
    id: invoiceSubscription(invoice),
    revoke: revoke || refunded,
    reversedInvoice: invoiceId,
  }
}

async function trustedOwner(
  client: PoolClient,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const customerId = stripeId(subscription.customer)
  const account = await client.query<{
    user_id: string
    deleting: boolean
    erased_at: Date | null
    mode: string
  }>(
    "select user_id,deleting,erased_at,mode from billing_accounts where customer_id=$1",
    [customerId]
  )
  const owner = account.rows[0]
  if (!owner) return null
  if (owner.erased_at || owner.deleting) return null
  if (owner.mode !== billingConfig().mode)
    throw new BillingError("billing_environment_mismatch")
  const attemptId = subscription.metadata.lg_attempt_id
  const attempt = await client.query<{ id: string; session_id: string }>(
    "select id,session_id from billing_attempts where id::text=$1 and user_id=$2",
    [attemptId ?? "", owner.user_id]
  )
  const row = attempt.rows[0]
  if (!row?.session_id) throw new BillingError("subscription_binding_pending")
  const session = await stripe.checkout.sessions.retrieve(row.session_id)
  if (
    !isManagedCheckout(session) ||
    stripeId(session.subscription) !== subscription.id ||
    stripeId(session.customer) !== customerId ||
    session.client_reference_id !== owner.user_id ||
    subscription.metadata.lg_user_id !== owner.user_id ||
    session.metadata?.lg_attempt_id !== row.id
  )
    throw new BillingError("subscription_binding_invalid")

  return owner.user_id
}

export async function refreshSubscription(
  pool: Pool,
  stripe: Stripe,
  id: string,
  reversal?: { revoke: boolean; reversedInvoice?: string }
) {
  return withBillingLock(pool, `subscription:${id}`, async (client) => {
    const subscription = await stripe.subscriptions.retrieve(id, {
      expand: ["latest_invoice", "schedule.phases.items.price"],
    })
    if (subscription.livemode !== (billingConfig().mode === "live"))
      throw new BillingError("subscription_environment_mismatch")
    if (subscription.metadata.lg_api_team_id) {
      await refreshApiSubscription(pool, stripe, id, reversal)

      return
    }
    const userId = await trustedOwner(client, stripe, subscription)
    if (!userId) return
    const existing = await client.query<MembershipRow>(
      "select * from billing_memberships where subscription_id=$1",
      [id]
    )
    const previous = existing.rows[0]?.snapshot ?? null
    const invoices = await stripe.invoices.list({
      subscription: id,
      status: "paid",
      limit: 10,
    })
    const snapshot = projectMembership(
      subscription,
      invoices.data,
      previous,
      new Date()
    )
    const reversedPeriod = invoices.data.find(
      (invoice) => invoice.id === reversal?.reversedInvoice
    )
    if (
      reversal?.revoke &&
      reversedPeriod?.lines.data.some(
        (line) =>
          new Date(line.period.end * 1000).toISOString() ===
          snapshot.paidThrough
      )
    )
      snapshot.revoked = true
    // A reversal of the current invoice suspends access immediately. Prior-period
    // refunds must not remove a later, settled paid period.
    // jsonb changes object key order; compare values so a replay keeps its revision.
    if (!isDeepStrictEqual(previous, snapshot)) {
      await client.query(
        "insert into billing_memberships(subscription_id,user_id,snapshot) select $1,$2,$3 from billing_accounts where user_id=$2 and not deleting and erased_at is null on conflict(subscription_id) do update set snapshot=excluded.snapshot,revision=billing_memberships.revision+1,updated_at=now() where exists(select 1 from billing_accounts where user_id=$2 and not deleting and erased_at is null)",
        [id, userId, snapshot]
      )
    }
    await client.query(
      "update billing_memberships set reconciled_at=now() where subscription_id=$1",
      [id]
    )
    await client.query(
      "update billing_attempts set state='complete',checkout_url=null,subscription_id=$2 where id::text=$1",
      [subscription.metadata.lg_attempt_id, id]
    )
  })
}

export async function syncMembership(pool: Pool, row: MembershipRow) {
  if (row.snapshot.mode !== billingConfig().mode)
    throw new BillingError("billing_environment_mismatch")
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError("billing_bridge_unavailable")
  const res = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/billing/sync-membership`,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify({
        baUserId: row.user_id,
        subscriptionId: row.subscription_id,
        revision: Number(row.revision),
        membership: row.snapshot,
      }),
    }
  )
  if (res.status === 410) {
    // A missing/deleted CMS profile must never be recreated by a late event.
    const erased = await pool.query(
      "select 1 from billing_accounts where user_id=$1 and erased_at is not null",
      [row.user_id]
    )
    if (!erased.rowCount) throw new BillingError("billing_profile_missing")
  }
  if (!res.ok && res.status !== 410)
    throw new BillingError("billing_sync_unavailable")
  await pool.query(
    "update billing_memberships set synced_revision=greatest(synced_revision,$2),sync_attempts=0,next_sync_at=now() where subscription_id=$1",
    [row.subscription_id, Number(row.revision)]
  )
  invalidateSessionProfile(row.user_id)
}

async function syncPendingMemberships(
  pool: Pool,
  client: PoolClient,
  withinBudget: () => boolean
) {
  const pending = await client.query<MembershipRow>(
    "select * from billing_memberships where synced_revision<revision and next_sync_at<=now() order by next_sync_at limit 30"
  )
  let synced = 0,
    failed = 0
  for (const row of pending.rows) {
    if (!withinBudget()) break
    try {
      await syncMembership(pool, row)
      synced++
    } catch {
      await client.query(
        "update billing_memberships set sync_attempts=sync_attempts+1,next_sync_at=now()+(least(3600,30*power(2,least(sync_attempts,7))) * interval '1 second') where subscription_id=$1",
        [row.subscription_id]
      )
      failed++
    }
  }

  return { synced, failed }
}

/** Run independently of the purchase flag; turning checkout off cannot stop recovery. */
export async function runBillingWorker(pool: Pool, stripe: Stripe) {
  return withBillingLock(pool, "worker", async (client) => {
    const started = Date.now()
    const withinBudget = (seconds: number) =>
      Date.now() - started < seconds * 1000
    const events = await client.query<EventRow>(
      "select * from billing_events where state='pending' and next_attempt_at<=now() order by received_at limit 30"
    )
    let processed = 0
    // Prioritize already-settled access before reading more provider events.
    let { failed, synced } = await syncPendingMemberships(pool, client, () =>
      withinBudget(10)
    )
    for (const event of events.rows) {
      if (!withinBudget(25)) break
      try {
        const target = await eventSubscription(stripe, event)
        if (target?.id)
          await refreshSubscription(pool, stripe, target.id, target)
        await client.query(
          "update billing_events set state=$2,completed_at=now(),attempts=attempts+1 where event_id=$1",
          [event.event_id, target?.id ? "complete" : "ignored"]
        )
        processed++
      } catch {
        await client.query(
          "update billing_events set attempts=attempts+1,next_attempt_at=now()+($2 * interval '1 second') where event_id=$1",
          [
            event.event_id,
            Math.min(3600, 30 * 2 ** Math.min(event.attempts, 7)),
          ]
        )
        failed++
      }
    }
    // Recover a lost completion webhook from our owned, persisted Checkout session.
    const attempts = await client.query<{ session_id: string; id: string }>(
      "select session_id,id from billing_attempts where state='open' and session_id is not null order by reconciled_at limit 10"
    )
    for (const attempt of attempts.rows) {
      if (!withinBudget(30)) break
      try {
        const session = await stripe.checkout.sessions.retrieve(
          attempt.session_id
        )
        const subscriptionId = stripeId(session.subscription)
        if (session.status === "complete" && subscriptionId)
          await refreshSubscription(pool, stripe, subscriptionId)
        if (session.status === "expired")
          await client.query(
            "update billing_attempts set state='expired',checkout_url=null where id=$1",
            [attempt.id]
          )
      } catch {
        failed++
      } finally {
        await client.query(
          "update billing_attempts set reconciled_at=now() where id=$1",
          [attempt.id]
        )
      }
    }
    const stale = await client.query<{ subscription_id: string }>(
      "select subscription_id from billing_memberships where reconciled_at<now()-interval '15 minutes' order by reconciled_at limit 10"
    )
    for (const row of stale.rows) {
      if (!withinBudget(35)) break
      try {
        await refreshSubscription(pool, stripe, row.subscription_id)
      } catch {
        await client.query(
          "update billing_memberships set reconciled_at=now() where subscription_id=$1",
          [row.subscription_id]
        )
        failed++
      }
    }
    // A purchase settled or recovered above can become usable in this pass,
    // rather than waiting for the next scheduled worker. Retry backoff still applies.
    const fresh = await syncPendingMemberships(pool, client, () =>
      withinBudget(35)
    )
    failed += fresh.failed
    synced += fresh.synced
    failed += await reconcileApiBilling(pool, stripe, () => withinBudget(45))
    await maintainApiUsage(pool)
    await client.query(
      "delete from billing_rate_limits where resets_at<now()-interval '1 day'"
    )

    const backlog = await client.query<{ events: string; projections: string }>(
      "select (select count(*) from billing_events where state='pending') as events,(select count(*) from billing_memberships where synced_revision<revision) as projections"
    )

    return {
      processed,
      synced,
      failed,
      pendingEvents: Number(backlog.rows[0]?.events ?? 0),
      pendingProjections: Number(backlog.rows[0]?.projections ?? 0),
    }
  })
}
