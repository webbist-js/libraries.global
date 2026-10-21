import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { invoiceSubscription } from "@/lib/billing/projection"
import { stripeId } from "@/lib/billing/provider"

import { MAX_TEAM_SEATS, MIN_TEAM_SEATS, type TeamMembership } from "./types"

const validSeats = (n: unknown): n is number =>
  Number.isSafeInteger(n) &&
  Number(n) >= MIN_TEAM_SEATS &&
  Number(n) <= MAX_TEAM_SEATS

function checkedSeatItem(subscription: Stripe.Subscription, priceId: string) {
  const item = subscription.items.data[0]
  if (
    subscription.items.has_more ||
    subscription.items.data.length !== 1 ||
    !item ||
    item.price.id !== priceId ||
    !validSeats(item.quantity) ||
    item.price.recurring?.interval !== "year" ||
    item.price.recurring.interval_count !== 1 ||
    item.price.recurring.usage_type !== "licensed" ||
    item.price.currency !== "gbp" ||
    item.price.tax_behavior !== "exclusive" ||
    !item.price.unit_amount ||
    item.price.unit_amount < 1
  )
    throw new BillingError("team_subscription_catalogue_mismatch")

  return { item, quantity: item.quantity, unitAmount: item.price.unit_amount }
}

function* settledSeatLines(
  subscription: Stripe.Subscription,
  invoices: readonly Stripe.Invoice[],
  priceId: string,
  itemId: string
) {
  for (const invoice of [...invoices].sort((a, b) => a.created - b.created)) {
    if (
      invoice.status !== "paid" ||
      invoiceSubscription(invoice) !== subscription.id ||
      invoice.lines.has_more
    )
      continue
    for (const line of invoice.lines.data) {
      const details = line.parent?.subscription_item_details
      if (
        stripeId(details?.subscription) !== subscription.id ||
        stripeId(details?.subscription_item) !== itemId ||
        stripeId(line.pricing?.price_details?.price) !== priceId ||
        !validSeats(line.quantity) ||
        (details?.proration && line.amount <= 0) ||
        !Number.isSafeInteger(line.period.end) ||
        line.period.end <= 0
      )
        continue
      yield { line, quantity: line.quantity }
    }
  }
}

function renewalCoverage(
  subscription: Stripe.Subscription,
  previous: TeamMembership | null,
  paidThrough: string | null,
  paidSeats: number,
  now: Date
) {
  const latest = subscription.latest_invoice
  const since =
    subscription.status === "past_due"
      ? (previous?.pastDueSince ??
        new Date(
          (latest && typeof latest !== "string"
            ? (latest.status_transitions.finalized_at ?? latest.created)
            : now.getTime() / 1000) * 1000
        ).toISOString())
      : null
  let accessUntil = paidThrough
  if (since && paidThrough && paidSeats > 0) {
    accessUntil = new Date(
      Math.max(
        Date.parse(paidThrough),
        Math.min(
          Date.parse(since) + 7 * 86_400_000,
          Date.parse(paidThrough) + 7 * 86_400_000
        )
      )
    ).toISOString()
  }

  return { since, accessUntil }
}

function scheduledSeats(
  subscription: Stripe.Subscription,
  priceId: string,
  now: Date
) {
  const schedule = subscription.schedule
  const future =
    schedule && typeof schedule !== "string" && schedule.status === "active"
      ? schedule.phases.find((phase) => phase.start_date * 1000 > now.getTime())
      : null
  const futureItem = future?.items[0]
  const pendingSeats =
    future?.items.length === 1 &&
    futureItem &&
    stripeId(futureItem.price) === priceId &&
    validSeats(futureItem.quantity)
      ? futureItem.quantity
      : null

  return {
    pendingSeats,
    pendingAt:
      pendingSeats && future
        ? new Date(future.start_date * 1000).toISOString()
        : null,
  }
}

/** Neither a subscription status nor an unpaid quantity increase proves coverage. */
export function projectTeamMembership(
  subscription: Stripe.Subscription,
  invoices: readonly Stripe.Invoice[],
  previous: TeamMembership | null,
  priceId: string,
  now = new Date()
): TeamMembership {
  const { item, quantity, unitAmount } = checkedSeatItem(subscription, priceId)

  let paidThrough = previous?.priceId === priceId ? previous.paidThrough : null
  let paidSeats = paidThrough ? previous!.paidSeats : 0
  // Chronological paid lines preserve seat-proration ordering.
  for (const { line, quantity: settledQuantity } of settledSeatLines(
    subscription,
    invoices,
    priceId,
    item.id
  )) {
    const end = new Date(line.period.end * 1000).toISOString()
    if (!paidThrough || end > paidThrough) {
      paidThrough = end
      paidSeats = settledQuantity
    } else if (end === paidThrough)
      paidSeats = Math.max(paidSeats, settledQuantity)
  }
  paidSeats = Math.min(paidSeats, quantity)
  const { since, accessUntil: coverageEnd } = renewalCoverage(
    subscription,
    previous,
    paidThrough,
    paidSeats,
    now
  )
  let accessUntil = coverageEnd
  const revoked = previous?.revoked ?? false
  if (
    revoked ||
    !["active", "past_due", "canceled"].includes(subscription.status) ||
    !paidSeats
  )
    accessUntil = null
  const { pendingSeats, pendingAt } = scheduledSeats(subscription, priceId, now)

  return {
    mode: subscription.livemode ? "live" : "sandbox",
    status: subscription.status,
    priceId,
    currency: item.price.currency,
    unitAmount,
    seats: quantity,
    paidSeats,
    paidThrough,
    accessUntil,
    pastDueSince: since,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    revoked,
    pendingSeats,
    pendingAt,
  }
}
