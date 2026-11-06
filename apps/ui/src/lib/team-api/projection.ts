import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { stripeId } from "@/lib/billing/provider"

import { API_DIMENSIONS } from "./constants"
import type { ApiDimension, ApiMembership, ApiOffer, ApiPeriod } from "./types"

export function invoiceSubscription(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription)
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

/**
 * Paid lines for the base Price on this subscription. Only a paid invoice of
 * this subscription, bound to the purchased Price, proves an access period.
 */
function* settledBaseLines(
  subscription: Stripe.Subscription,
  invoices: readonly Stripe.Invoice[],
  priceId: string
) {
  for (const invoice of invoices) {
    if (
      invoice.status !== "paid" ||
      invoiceSubscription(invoice) !== subscription.id ||
      stripeId(invoice.customer) !== stripeId(subscription.customer)
    )
      continue
    for (const line of invoice.lines.data) {
      const details = line.parent?.subscription_item_details
      if (
        stripeId(details?.subscription) !== subscription.id ||
        stripeId(line.pricing?.price_details?.price) !== priceId ||
        details?.proration ||
        line.amount <= 0 ||
        !Number.isFinite(line.period.start) ||
        !Number.isFinite(line.period.end) ||
        line.period.end <= line.period.start
      )
        continue
      yield { invoice, line }
    }
  }
}

/**
 * The base item plus, optionally, one metered item per overage Price in the
 * purchase snapshot. Anything else is a catalogue mismatch.
 */
function checkedItems(subscription: Stripe.Subscription, offer: ApiOffer) {
  const items = subscription.items.data
  const base = items.filter((item) => item.price.id === offer.priceId)
  const item = base[0]
  if (
    base.length !== 1 ||
    !item ||
    item.quantity !== 1 ||
    item.price.recurring?.interval !== "month" ||
    item.price.recurring.interval_count !== 1 ||
    item.price.recurring.usage_type !== "licensed" ||
    item.price.unit_amount === null
  )
    throw new BillingError("api_subscription_catalogue_mismatch")
  const overageItems: Partial<Record<ApiDimension, string>> = {}
  for (const other of items) {
    if (other === item) continue
    const dimension = API_DIMENSIONS.find(
      (d) => offer.overagePrices[d] === other.price.id
    )
    if (
      !dimension ||
      overageItems[dimension] ||
      other.price.recurring?.usage_type !== "metered"
    )
      throw new BillingError("api_subscription_catalogue_mismatch")
    overageItems[dimension] = other.id
  }

  return { item, unitAmount: item.price.unit_amount, overageItems }
}

/**
 * Status and checkout completion alone never prove paid API coverage. The
 * quota period is the latest settled base line's `[start, end)`; a renewal
 * that is unpaid leaves the previous (ended) period in place, so no new
 * allowance opens until its invoice is paid.
 */
export function projectApiMembership(
  subscription: Stripe.Subscription,
  invoices: readonly Stripe.Invoice[],
  previous: ApiMembership | null,
  offer: ApiOffer
): ApiMembership {
  const { item, unitAmount, overageItems } = checkedItems(subscription, offer)
  const keep = previous?.offer?.priceId === offer.priceId
  let period: ApiPeriod | null = keep ? previous.period : null
  let startedAt = keep ? previous.startedAt : null
  for (const { invoice, line } of settledBaseLines(
    subscription,
    invoices,
    offer.priceId
  )) {
    const candidate = {
      start: iso(line.period.start),
      end: iso(line.period.end),
    }
    if (!period || candidate.end > period.end) period = candidate
    // Access opens at settlement, even for a late-paid first invoice.
    const paidAt = invoice.status_transitions?.paid_at ?? line.period.start
    if (Number.isFinite(paidAt) && paidAt > 0) {
      const start = iso(paidAt)
      if (!startedAt || start < startedAt) startedAt = start
    }
  }

  return {
    mode: subscription.livemode ? "live" : "sandbox",
    status: subscription.status,
    priceId: offer.priceId,
    currency: item.price.currency,
    unitAmount,
    paidThrough: period?.end ?? null,
    period,
    startedAt,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    revoked: previous?.revoked ?? false,
    offer,
    overageItems,
    limits: offer.limits,
  }
}
