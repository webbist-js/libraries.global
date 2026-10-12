import "server-only"

import type Stripe from "stripe"

import { BillingError, planForPrice } from "./config"
import { stripeId } from "./provider"

function scheduledChange(subscription: Stripe.Subscription) {
  const schedule = subscription.schedule
  if (!schedule || typeof schedule === "string" || schedule.status !== "active")
    return null
  const current = schedule.current_phase
  const phase =
    current && schedule.phases.find((p) => p.start_date >= current.end_date)
  if (!phase || phase.items.length !== 1) return null
  const price = phase.items[0]?.price
  if (!price || typeof price === "string" || price.deleted) return null
  const choice = planForPrice(price.id)
  if (!choice || price.unit_amount === null) return null

  return {
    ...choice,
    date: phase.start_date,
    unitAmount: price.unit_amount,
    currency: price.currency,
  }
}

/** Safe display data, fetched after establishing the session's stored customer. */
export async function providerOverview(
  stripe: Stripe,
  subscriptionId: string,
  customerId: string,
  mode: "sandbox" | "live"
) {
  const [subscription, customer] = await Promise.all([
    stripe.subscriptions.retrieve(subscriptionId, {
      expand: [
        "default_payment_method",
        "latest_invoice",
        "schedule.phases.items.price",
      ],
    }),
    stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    }),
  ])
  if (
    subscription.livemode !== (mode === "live") ||
    stripeId(subscription.customer) !== customerId ||
    customer.deleted
  )
    throw new BillingError("billing_provider_binding_invalid")
  const method =
    subscription.default_payment_method ??
    customer.invoice_settings.default_payment_method
  const card = method && typeof method !== "string" ? method.card : null
  const invoice =
    subscription.latest_invoice &&
    typeof subscription.latest_invoice !== "string"
      ? subscription.latest_invoice
      : null

  return {
    paymentMethod: card
      ? {
          brand: card.brand,
          last4: card.last4,
          expiryMonth: card.exp_month,
          expiryYear: card.exp_year,
          wallet: card.wallet?.type ?? null,
        }
      : null,
    billingDetails: {
      name: customer.name,
      email: customer.email,
      postalCode: customer.address?.postal_code ?? null,
    },
    foundingPrice:
      subscription.items.data[0]?.price.metadata.lg_cohort === "founding",
    scheduledChange: scheduledChange(subscription),
    nextAttempt: invoice?.next_payment_attempt
      ? {
          date: invoice.next_payment_attempt,
          total: invoice.amount_due,
          currency: invoice.currency,
        }
      : null,
  }
}
