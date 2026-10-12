import type { PaidMembership } from "@repo/access"
import type Stripe from "stripe"

import { BillingError, planForPrice } from "./config"
import { stripeId } from "./provider"

const iso = (seconds: number | null | undefined) =>
  seconds && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null

export function invoiceSubscription(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription)
}

/** Re-fetch provider state rather than applying an old event's status. */
export function projectMembership(
  subscription: Stripe.Subscription,
  paidInvoices: readonly Stripe.Invoice[],
  previous: PaidMembership | null,
  now: Date
): PaidMembership {
  const items = subscription.items.data
  const item = items[0]
  const selection =
    item &&
    (planForPrice(item.price.id) ??
      (previous?.settledPriceId === item.price.id
        ? { plan: previous.plan, interval: previous.interval }
        : null))
  if (items.length !== 1 || !item || !selection || item.quantity !== 1)
    throw new BillingError("subscription_catalogue_mismatch")
  if (
    item.price.recurring?.interval !== selection.interval ||
    item.price.unit_amount === null
  )
    throw new BillingError("subscription_price_invalid")

  // A paid status on the subscription is not settlement evidence. Only paid invoice
  // lines belonging to this subscription extend the proven paid period.
  let paidThrough =
    previous?.settledPriceId === item.price.id ? previous.paidThrough : null
  for (const invoice of paidInvoices) {
    if (
      invoice.status !== "paid" ||
      invoiceSubscription(invoice) !== subscription.id
    )
      continue
    for (const line of invoice.lines.data) {
      const details = line.parent?.subscription_item_details
      if (
        stripeId(details?.subscription) !== subscription.id ||
        (details?.proration && line.amount <= 0) ||
        stripeId(line.pricing?.price_details?.price) !== item.price.id
      )
        continue
      const end = iso(line.period.end)
      if (end && (!paidThrough || end > paidThrough)) paidThrough = end
    }
  }
  const pastDue = subscription.status === "past_due"
  const latest = subscription.latest_invoice
  const delinquentSince =
    latest && typeof latest !== "string"
      ? iso(latest.status_transitions.finalized_at ?? latest.created)
      : null
  const since = pastDue
    ? (previous?.pastDueSince ?? delinquentSince ?? now.toISOString())
    : null
  const graceExpired = Boolean(
    since && now.getTime() - Date.parse(since) > 7 * 86_400_000
  )

  // An unpaid upgrade cannot turn a settled Supporter period into Pro. Retain
  // the already-paid plan until an invoice proves settlement at the new price.
  if (!paidThrough && previous?.paidThrough)
    return {
      ...previous,
      status: subscription.status,
      pastDueSince: since,
      graceExpired,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }

  return {
    mode: subscription.livemode ? "live" : "sandbox",
    plan: selection.plan,
    interval: selection.interval,
    currency: item.price.currency,
    unitAmount: item.price.unit_amount,
    status: subscription.status,
    memberSince:
      previous?.memberSince ??
      iso(subscription.start_date) ??
      now.toISOString(),
    periodEnd: iso(item.current_period_end),
    paidThrough,
    pastDueSince: pastDue
      ? (previous?.pastDueSince ?? delinquentSince ?? now.toISOString())
      : null,
    graceExpired,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    revoked: previous?.revoked ?? false,
    ...(paidThrough ? { settledPriceId: item.price.id } : {}),
  }
}
