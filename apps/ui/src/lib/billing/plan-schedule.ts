import "server-only"

import { randomUUID } from "node:crypto"

import { isPaidMembership } from "@repo/access"
import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"

import {
  BillingError,
  billingConfig,
  planForPrice,
  type PurchasePlan,
  type PurchaseInterval,
} from "./config"
import { withBillingLock } from "./database"
import { stripeId } from "./provider"

type Change = {
  id: string
  price_id: string
  period_end: string
  schedule_id: string | null
  state: string
  created_at: Date
}

/** A reduction never changes the paid phase or takes payment now. */
export async function schedulePlanChange(
  client: PoolClient,
  stripe: Stripe,
  userId: string,
  subscription: Stripe.Subscription,
  target: Stripe.Price,
  choice: {
    plan: PurchasePlan
    interval: PurchaseInterval
    action?: "review" | "confirm"
    effectiveAt?: number
  }
) {
  const item = subscription.items.data[0]!
  const end = item.current_period_end
  const quote = {
    kind: "schedule" as const,
    plan: choice.plan,
    interval: choice.interval,
    effectiveAt: end,
    unitAmount: target.unit_amount!,
    currency: target.currency,
  }
  if (!Number.isSafeInteger(end) || end * 1000 <= Date.now())
    throw new BillingError("membership_not_changeable", 409)
  const pending = await client.query<Change>(
    "select * from billing_plan_changes where subscription_id=$1 and state in ('preparing','scheduled') limit 1",
    [subscription.id]
  )
  let change = pending.rows[0]
  if (change?.schedule_id && !subscription.schedule) {
    const prior = await stripe.subscriptionSchedules.retrieve(
      change.schedule_id
    )
    if (
      stripeId(prior.customer) !== stripeId(subscription.customer) ||
      prior.livemode !== subscription.livemode ||
      prior.metadata?.lg_change_id !== change.id
    )
      throw new BillingError("schedule_binding_invalid")
    if (!["released", "canceled", "completed"].includes(prior.status))
      throw new BillingError("membership_change_pending", 409)
    await client.query(
      "update billing_plan_changes set state='released' where id=$1",
      [change.id]
    )
    change = undefined
  }
  if (
    subscription.schedule &&
    (!change ||
      (change.schedule_id &&
        stripeId(subscription.schedule) !== change.schedule_id))
  )
    throw new BillingError("membership_change_pending", 409)
  if (choice.action !== "confirm") return { ...quote, scheduled: false }
  if (choice.effectiveAt !== end)
    throw new BillingError("membership_quote_changed", 409)
  if (
    change &&
    (change.price_id !== target.id || Number(change.period_end) !== end)
  )
    throw new BillingError("membership_change_pending", 409)
  if (!change) {
    const created = await client.query<Change>(
      "insert into billing_plan_changes(id,user_id,subscription_id,price_id,period_end) values($1,$2,$3,$4,$5) returning *",
      [randomUUID(), userId, subscription.id, target.id, end]
    )
    change = created.rows[0]!
  }
  if (
    !change.schedule_id &&
    Date.now() - new Date(change.created_at).getTime() > 23 * 3_600_000
  )
    throw new BillingError("membership_change_requires_reconciliation", 409)
  const schedule = change.schedule_id
    ? await stripe.subscriptionSchedules.retrieve(change.schedule_id)
    : await stripe.subscriptionSchedules.create(
        { from_subscription: subscription.id },
        { idempotencyKey: `lg-schedule-create:${change.id}` }
      )
  if (
    stripeId(schedule.subscription) !== subscription.id ||
    stripeId(schedule.customer) !== stripeId(subscription.customer) ||
    schedule.livemode !== subscription.livemode ||
    schedule.status !== "active" ||
    !schedule.current_phase ||
    schedule.current_phase.end_date !== end ||
    (subscription.schedule &&
      stripeId(subscription.schedule) !== schedule.id) ||
    (schedule.metadata?.lg_change_id &&
      schedule.metadata.lg_change_id !== change.id)
  )
    throw new BillingError("schedule_binding_invalid")
  await client.query(
    "update billing_plan_changes set schedule_id=$2 where id=$1",
    [change.id, schedule.id]
  )
  const updated = await stripe.subscriptionSchedules.update(
    schedule.id,
    {
      end_behavior: "release",
      metadata: {
        lg_user_id: userId,
        lg_change: "period_end",
        lg_change_id: change.id,
        lg_period_end: String(end),
      },
      phases: [
        {
          start_date: schedule.current_phase.start_date,
          end_date: end,
          items: [{ price: item.price.id, quantity: 1 }],
          proration_behavior: "none",
        },
        {
          start_date: end,
          duration: { interval: choice.interval, interval_count: 1 },
          items: [{ price: target.id, quantity: 1 }],
          proration_behavior: "none",
        },
      ],
    },
    { idempotencyKey: `lg-schedule-update:${change.id}` }
  )
  if (
    updated.phases[1]?.start_date !== end ||
    stripeId(updated.phases[1]?.items[0]?.price) !== target.id
  )
    throw new BillingError("schedule_confirmation_invalid")
  await client.query(
    "update billing_plan_changes set state='scheduled' where id=$1",
    [change.id]
  )

  return { ...quote, scheduled: true }
}

/** Undo only an owned future change. Releasing preserves the current subscription. */
export async function undoPlanChange(
  pool: Pool,
  stripe: Stripe,
  userId: string
) {
  return withBillingLock(pool, `user:${userId}`, async (client) => {
    const result = await client.query<
      Change & { subscription_id: string; customer_id: string }
    >(
      "select c.*,a.customer_id from billing_plan_changes c join billing_accounts a using(user_id) where c.user_id=$1 and c.state in ('preparing','scheduled') and a.mode=$2 and a.erased_at is null and not a.deleting order by c.created_at desc limit 1",
      [userId, billingConfig().mode]
    )
    const change = result.rows[0]
    if (!change?.schedule_id || Number(change.period_end) * 1000 <= Date.now())
      throw new BillingError("scheduled_change_not_found", 409)
    const [subscription, schedule] = await Promise.all([
      stripe.subscriptions.retrieve(change.subscription_id),
      stripe.subscriptionSchedules.retrieve(change.schedule_id),
    ])
    if (
      stripeId(subscription.customer) !== change.customer_id ||
      subscription.metadata.lg_user_id !== userId ||
      subscription.livemode !== (billingConfig().mode === "live") ||
      stripeId(schedule.customer) !== change.customer_id ||
      schedule.livemode !== subscription.livemode ||
      schedule.metadata?.lg_change_id !== change.id
    )
      throw new BillingError("schedule_binding_invalid")
    if (schedule.status !== "released") {
      if (
        stripeId(subscription.schedule) !== schedule.id ||
        schedule.current_phase?.end_date !== Number(change.period_end)
      )
        throw new BillingError("membership_change_pending", 409)
      await stripe.subscriptionSchedules.release(
        schedule.id,
        {},
        { idempotencyKey: `lg-schedule-undo:${change.id}` }
      )
    }
    await client.query(
      "update billing_plan_changes set state='released' where id=$1",
      [change.id]
    )

    return { undone: true }
  })
}

/** Release the schedule once its target phase has actually started, permitting later changes. */
export async function finishPlanChanges(pool: Pool, stripe: Stripe) {
  const result = await pool.query<
    Change & { user_id: string; subscription_id: string; customer_id: string }
  >(
    "select c.*,a.customer_id from billing_plan_changes c join billing_accounts a using(user_id) where (c.state='preparing' and c.created_at<now()-interval '5 seconds' or c.state='scheduled' and c.period_end<=extract(epoch from now())) and a.mode=$1 and a.erased_at is null and not a.deleting order by c.created_at limit 1",
    [billingConfig().mode]
  )
  let finished = 0
  for (const candidate of result.rows)
    await withBillingLock(pool, `user:${candidate.user_id}`, async (client) => {
      // The owner may undo or erase after the candidate scan and before this lock.
      const fresh = await client.query<
        Change & {
          user_id: string
          subscription_id: string
          customer_id: string
        }
      >(
        "select c.*,a.customer_id from billing_plan_changes c join billing_accounts a using(user_id) where c.id=$1 and c.user_id=$2 and c.state in ('preparing','scheduled') and a.mode=$3 and a.erased_at is null and not a.deleting",
        [candidate.id, candidate.user_id, billingConfig().mode]
      )
      const change = fresh.rows[0]
      if (
        !change ||
        (change.state === "scheduled" &&
          Number(change.period_end) * 1000 > Date.now())
      )
        return
      const subscription = await stripe.subscriptions.retrieve(
        change.subscription_id,
        { expand: ["latest_invoice"] }
      )
      if (
        stripeId(subscription.customer) !== change.customer_id ||
        subscription.metadata.lg_user_id !== change.user_id ||
        subscription.livemode !== (billingConfig().mode === "live")
      )
        throw new BillingError("schedule_binding_invalid")
      if (change.state === "preparing") {
        const selection = planForPrice(change.price_id)
        const member = await client.query<{ snapshot: unknown }>(
          "select snapshot from billing_memberships where subscription_id=$1 and user_id=$2",
          [subscription.id, change.user_id]
        )
        const snapshot = member.rows[0]?.snapshot
        const invoice = subscription.latest_invoice
        if (
          !selection ||
          !isPaidMembership(snapshot) ||
          snapshot.revoked ||
          snapshot.graceExpired ||
          !snapshot.paidThrough ||
          Date.parse(snapshot.paidThrough) < Number(change.period_end) * 1000 ||
          subscription.status !== "active" ||
          subscription.cancel_at_period_end ||
          subscription.pending_update ||
          (invoice &&
            typeof invoice !== "string" &&
            invoice.status !== "paid" &&
            invoice.amount_due > 0)
        )
          throw new BillingError(
            "membership_change_requires_reconciliation",
            409
          )
        const target = await stripe.prices.retrieve(change.price_id, {
          expand: ["product"],
        })
        const product = target.product
        if (
          !target.active ||
          target.livemode !== subscription.livemode ||
          target.currency !== "gbp" ||
          target.recurring?.interval !== selection.interval ||
          target.recurring.interval_count !== 1 ||
          typeof product === "string" ||
          product.deleted ||
          !product.active ||
          !product.tax_code
        )
          throw new BillingError("price_unavailable")
        await schedulePlanChange(
          client,
          stripe,
          change.user_id,
          subscription,
          target,
          {
            ...selection,
            action: "confirm",
            effectiveAt: Number(change.period_end),
          }
        )
        finished++

        return
      }
      if (!change.schedule_id) return
      const schedule = await stripe.subscriptionSchedules.retrieve(
        change.schedule_id
      )
      if (
        stripeId(subscription.customer) !== change.customer_id ||
        subscription.metadata.lg_user_id !== change.user_id ||
        subscription.livemode !== (billingConfig().mode === "live") ||
        stripeId(schedule.customer) !== change.customer_id ||
        schedule.livemode !== subscription.livemode ||
        stripeId(schedule.subscription ?? schedule.released_subscription) !==
          subscription.id ||
        schedule.metadata?.lg_change_id !== change.id
      )
        throw new BillingError("schedule_binding_invalid")
      if (schedule.status !== "released") {
        if (
          schedule.status !== "active" ||
          stripeId(subscription.schedule) !== schedule.id ||
          (schedule.current_phase?.start_date ?? 0) <
            Number(change.period_end) ||
          subscription.items.data[0]?.price.id !== change.price_id
        )
          return
        await stripe.subscriptionSchedules.release(
          schedule.id,
          {},
          { idempotencyKey: `lg-schedule-finish:${change.id}` }
        )
      }
      await client.query(
        "update billing_plan_changes set state='released' where id=$1",
        [change.id]
      )
      finished++
    })

  return finished
}
