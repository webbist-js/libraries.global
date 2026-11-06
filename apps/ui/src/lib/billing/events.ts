import "server-only"

import type { Pool } from "pg"
import type Stripe from "stripe"

import {
  reconcileApiAttempts,
  refreshApiSubscription,
} from "@/lib/team-api/billing"
import { deliverApiMeters, reconcileApiPeriods } from "@/lib/team-api/meters"
import { invoiceSubscription } from "@/lib/team-api/projection"
import { maintainApiUsage } from "@/lib/team-api/store"
import { deliverApiWarnings } from "@/lib/team-api/sync"

import { BillingError, billingConfig } from "./config"
import { withBillingLock } from "./database"
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
  "invoice.finalized",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.marked_uncollectible",
  "invoice.voided",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "refund.updated",
])
type EventRow = {
  event_id: string
  event_type: string
  object_id: string
  attempts: number
}

/**
 * Signed webhook intake. Persist only references, never raw bodies with
 * personal data. Replays share the event id; processing refetches provider
 * state, so delivery order never matters. Events from the other mode or a
 * connected account are refused.
 */
export async function receiveBillingEvent(pool: Pool, event: Stripe.Event) {
  if (event.livemode !== (billingConfig().mode === "live") || event.account)
    throw new BillingError("webhook_environment_mismatch", 400)
  if (!BILLING_EVENTS.has(event.type)) return
  const object = event.data.object as { id?: unknown }
  if (typeof object.id !== "string")
    throw new BillingError("webhook_object_invalid", 400)
  await pool.query(
    "insert into billing_events(event_id,event_type,object_id) values($1,$2,$3) on conflict do nothing",
    [event.id, event.type, object.id]
  )
}

/** The API subscription an event concerns, and whether it reverses payment. */
export async function eventSubscription(stripe: Stripe, event: EventRow) {
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

/**
 * Run independently of the purchase flags: turning checkout or overage off
 * never stops renewals, recovery, meter delivery or reconciliation.
 */
export async function runBillingWorker(pool: Pool, stripe: Stripe) {
  return withBillingLock(pool, "worker", async (client) => {
    const started = Date.now()
    const withinBudget = (seconds: number) =>
      Date.now() - started < seconds * 1000
    // Refund abandoned reservations first so limits recover promptly.
    await maintainApiUsage(pool)
    const events = await client.query<EventRow>(
      "select * from billing_events where state='pending' and next_attempt_at<=now() order by received_at limit 30"
    )
    let processed = 0,
      failed = 0
    for (const event of events.rows) {
      if (!withinBudget(20)) break
      try {
        const target = await eventSubscription(stripe, event)
        const owned = target?.id
          ? await refreshApiSubscription(pool, stripe, target.id, target)
          : false
        await client.query(
          "update billing_events set state=$2,completed_at=now(),attempts=attempts+1 where event_id=$1",
          [event.event_id, owned ? "complete" : "ignored"]
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
    failed += await reconcileApiAttempts(pool, stripe, () => withinBudget(30))
    const meters = await deliverApiMeters(pool, stripe, () => withinBudget(45))
    failed += meters.failed
    failed += await reconcileApiPeriods(pool, stripe, () => withinBudget(50))
    failed += await deliverApiWarnings(pool, () => withinBudget(55))
    await client.query(
      "delete from billing_rate_limits where resets_at<now()-interval '1 day'"
    )
    const backlog = await client.query<{
      events: string
      meters: string
      dead: string
    }>(
      "select (select count(*) from billing_events where state='pending') as events,(select count(*) from api_meter_deliveries where state='pending') as meters,(select count(*) from api_meter_deliveries where state='dead') as dead"
    )
    const row = backlog.rows[0]

    return {
      processed,
      delivered: meters.delivered,
      failed,
      pendingEvents: Number(row?.events ?? 0),
      pendingMeters: Number(row?.meters ?? 0),
      deadMeters: Number(row?.dead ?? 0),
    }
  })
}
