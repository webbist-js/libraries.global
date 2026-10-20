import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { invoiceSubscription } from "@/lib/billing/projection"
import { stripeId } from "@/lib/billing/provider"

import type { ApiLimits, ApiMembership } from "./types"

/** Status and checkout completion alone never prove paid API coverage. */
export function projectApiMembership(
  subscription: Stripe.Subscription,
  invoices: readonly Stripe.Invoice[],
  previous: ApiMembership | null,
  priceId: string,
  limits: ApiLimits
): ApiMembership {
  const item = subscription.items.data[0]
  if (
    subscription.items.data.length !== 1 ||
    !item ||
    item.quantity !== 1 ||
    item.price.id !== priceId ||
    item.price.recurring?.interval !== "month" ||
    item.price.recurring.interval_count !== 1 ||
    item.price.unit_amount === null
  )
    throw new BillingError("api_subscription_catalogue_mismatch")
  let paidThrough = previous?.priceId === priceId ? previous.paidThrough : null
  let startedAt = previous?.startedAt ?? null
  for (const invoice of invoices) {
    if (
      invoice.status !== "paid" ||
      invoiceSubscription(invoice) !== subscription.id
    )
      continue
    for (const line of invoice.lines.data) {
      const details = line.parent?.subscription_item_details
      if (
        stripeId(details?.subscription) !== subscription.id ||
        stripeId(line.pricing?.price_details?.price) !== priceId ||
        (details?.proration && line.amount <= 0) ||
        !Number.isFinite(line.period.end)
      )
        continue
      const end = new Date(line.period.end * 1000).toISOString()
      if (!paidThrough || end > paidThrough) paidThrough = end
      // Payment settlement is when access actually opens, even for late invoices.
      const paidAt =
        previous?.paidThrough && previous.startedAt === undefined
          ? subscription.start_date
          : (invoice.status_transitions?.paid_at ?? line.period.start)
      if (Number.isFinite(paidAt) && paidAt > 0) {
        const start = new Date(paidAt * 1000).toISOString()
        if (!startedAt || start < startedAt) startedAt = start
      }
    }
  }

  return {
    mode: subscription.livemode ? "live" : "sandbox",
    status: subscription.status,
    priceId,
    currency: item.price.currency,
    unitAmount: item.price.unit_amount,
    paidThrough,
    startedAt,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    revoked: previous?.revoked ?? false,
    limits,
  }
}
