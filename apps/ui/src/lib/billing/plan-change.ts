import "server-only"

import { isPaidMembership } from "@repo/access"
import type { Pool } from "pg"
import type Stripe from "stripe"

import {
  BillingError,
  billingConfig,
  type PurchaseInterval,
  type PurchasePlan,
} from "./config"
import { withBillingLock } from "./database"
import { schedulePlanChange } from "./plan-schedule"
import { providerUrl, stripeId } from "./provider"

/** Stripe owns the final proration preview, consent and payment confirmation. */
export async function createPlanChangePortal(
  pool: Pool,
  stripe: Stripe,
  userId: string,
  choice: {
    plan: PurchasePlan
    interval: PurchaseInterval
    locale: "en" | "cs" | "fr"
    complimentaryPro?: boolean
    action?: "review" | "confirm"
    effectiveAt?: number
  }
) {
  const config = billingConfig()
  if (choice.plan === "supporter" && !config.supporterApproved)
    throw new BillingError("supporter_pending_approval", 409)
  const priceId = config.prices[choice.plan][choice.interval]
  if (
    !config.configured ||
    !priceId?.startsWith("price_") ||
    !config.portalConfiguration
  )
    throw new BillingError("price_unavailable")

  return withBillingLock(pool, `user:${userId}`, async (client) => {
    const accounts = await client.query<{
      customer_id: string
      mode: string
      deleting: boolean
      erased_at: Date | null
    }>(
      "select customer_id,mode,deleting,erased_at from billing_accounts where user_id=$1",
      [userId]
    )
    const account = accounts.rows[0]
    if (
      !account?.customer_id ||
      account.mode !== config.mode ||
      account.deleting ||
      account.erased_at
    )
      throw new BillingError("billing_account_not_found", 404)
    const memberships = await client.query<{
      subscription_id: string
      snapshot: unknown
    }>(
      "select subscription_id,snapshot from billing_memberships where user_id=$1 order by snapshot->>'memberSince' desc limit 1",
      [userId]
    )
    const row = memberships.rows[0]
    if (
      !row ||
      !isPaidMembership(row.snapshot) ||
      row.snapshot.mode !== config.mode ||
      !row.snapshot.paidThrough ||
      Date.parse(row.snapshot.paidThrough) <= Date.now() ||
      row.snapshot.revoked ||
      row.snapshot.graceExpired
    )
      throw new BillingError("membership_not_changeable", 409)
    if (
      choice.plan === "pro" &&
      choice.complimentaryPro &&
      row.snapshot.plan !== "pro"
    )
      throw new BillingError("complimentary_pro_already_available", 409)
    const subscription = await stripe.subscriptions.retrieve(
      row.subscription_id,
      { expand: ["latest_invoice"] }
    )
    if (
      stripeId(subscription.customer) !== account.customer_id ||
      subscription.livemode !== (config.mode === "live") ||
      subscription.metadata.lg_user_id !== userId
    )
      throw new BillingError("subscription_binding_invalid")
    if (
      subscription.status !== "active" ||
      subscription.pending_update ||
      subscription.cancel_at_period_end
    )
      throw new BillingError("membership_change_pending", 409)
    const item = subscription.items.data[0]
    if (!item || subscription.items.data.length !== 1 || item.quantity !== 1)
      throw new BillingError("subscription_catalogue_mismatch")
    const latest = subscription.latest_invoice
    if (
      latest &&
      typeof latest !== "string" &&
      latest.status !== "paid" &&
      latest.amount_due > 0
    )
      throw new BillingError("membership_payment_pending", 409)
    if (item.price.id === priceId)
      throw new BillingError("membership_already_selected", 409)
    const target = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    })
    const product = target.product
    if (
      !target.active ||
      target.livemode !== (config.mode === "live") ||
      target.currency !== "gbp" ||
      target.recurring?.interval !== choice.interval ||
      target.recurring.interval_count !== 1 ||
      target.unit_amount === null ||
      typeof product === "string" ||
      product.deleted ||
      !product.active ||
      !product.tax_code
    )
      throw new BillingError("price_unavailable")
    if (
      choice.plan === "pro" &&
      item.price.metadata.lg_cohort === "founding" &&
      target.metadata.lg_cohort !== "founding"
    )
      throw new BillingError("founding_price_requires_review", 409)
    const reduction =
      (row.snapshot.plan === "pro" && choice.plan === "supporter") ||
      (row.snapshot.interval === "year" && choice.interval === "month")
    if (reduction) {
      if (Date.parse(row.snapshot.paidThrough) < item.current_period_end * 1000)
        throw new BillingError("membership_payment_pending", 409)

      return schedulePlanChange(
        client,
        stripe,
        userId,
        subscription,
        target,
        choice
      )
    }
    if (subscription.schedule)
      throw new BillingError("membership_change_pending", 409)
    if (choice.action === "confirm")
      throw new BillingError("invalid_membership_choice", 400)
    const prefix = choice.locale === "en" ? "" : `/${choice.locale}`
    const returnUrl = `${config.origin}${prefix}/profile/membership`
    const portalConfiguration =
      row.snapshot.plan === "supporter"
        ? config.supporterPortalConfiguration
        : config.portalConfiguration
    if (!portalConfiguration)
      throw new BillingError("portal_configuration_unavailable")
    const session = await stripe.billingPortal.sessions.create({
      customer: account.customer_id,
      configuration: portalConfiguration,
      return_url: returnUrl,
      locale: choice.locale,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: subscription.id,
          items: [{ id: item.id, price: target.id, quantity: 1 }],
        },
        after_completion: {
          type: "redirect",
          redirect: { return_url: returnUrl },
        },
      },
    })

    return { url: providerUrl(session.url, ["billing.stripe.com"]) }
  })
}
