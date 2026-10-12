import "server-only"

import { randomUUID } from "node:crypto"

import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"

import {
  BillingError,
  billingConfig,
  configuredPrice,
  MEMBERSHIP_TERMS_VERSION,
  type PurchaseInterval,
  type PurchasePlan,
} from "./config"
import { withBillingLock } from "./database"
import { providerUrl, type ManagedCheckoutParams } from "./provider"

type Buyer = { id: string; email: string; name: string }
type Attempt = {
  id: string
  plan: PurchasePlan
  interval: PurchaseInterval
  price_id: string
  session_id: string | null
  checkout_url: string | null
  state: string
  created_at: Date
  expires_at: Date | null
}
type Account = {
  mode: string
  customer_id: string | null
  create_token: string
  created_at: Date
  deleting: boolean
  erased_at: Date | null
}

async function customerFor(client: PoolClient, stripe: Stripe, buyer: Buyer) {
  await client.query(
    "insert into billing_accounts(user_id,create_token,mode) values($1,$2,$3) on conflict do nothing",
    [buyer.id, randomUUID(), billingConfig().mode]
  )
  const { rows } = await client.query<Account>(
    "select * from billing_accounts where user_id=$1",
    [buyer.id]
  )
  const account = rows[0]
  if (!account || account.deleting || account.erased_at)
    throw new BillingError("account_unavailable", 409)
  if (account.mode !== billingConfig().mode)
    throw new BillingError("billing_environment_mismatch")
  if (account.customer_id) return account.customer_id
  if (Date.now() - account.created_at.getTime() > 23 * 3_600_000)
    throw new BillingError("customer_creation_needs_reconciliation")
  const customer = await stripe.customers.create(
    {
      email: buyer.email,
      name: buyer.name,
      metadata: { lg_user_id: buyer.id },
    },
    { idempotencyKey: `lg-customer:${account.create_token}` }
  )
  await client.query(
    "update billing_accounts set customer_id=$2 where user_id=$1",
    [buyer.id, customer.id]
  )

  return customer.id
}

export async function createManagedCheckout(
  pool: Pool,
  stripe: Stripe,
  buyer: Buyer,
  choice: {
    plan: PurchasePlan
    interval: PurchaseInterval
    locale: "en" | "cs" | "fr"
    termsVersion: string
  }
) {
  const priceId = configuredPrice(choice.plan, choice.interval)
  if (choice.termsVersion !== MEMBERSHIP_TERMS_VERSION)
    throw new BillingError("membership_terms_required", 400)

  return withBillingLock(pool, `user:${buyer.id}`, async (client) => {
    const exists = await client.query(
      'select id from "user" where id=$1 and "emailVerified"=true',
      [buyer.id]
    )
    if (!exists.rowCount)
      throw new BillingError("verified_account_required", 403)
    const customer = await customerFor(client, stripe, buyer)
    const subscriptions = await stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    })
    if (
      subscriptions.has_more ||
      subscriptions.data.some(
        (s) => !["canceled", "incomplete_expired"].includes(s.status)
      )
    )
      throw new BillingError("membership_already_exists", 409)

    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] })
    if (
      !price.active ||
      price.livemode !== (billingConfig().mode === "live") ||
      price.recurring?.interval !== choice.interval ||
      price.recurring.interval_count !== 1 ||
      price.unit_amount === null ||
      price.currency !== "gbp"
    )
      throw new BillingError("price_unavailable")
    const product = price.product
    if (
      typeof product === "string" ||
      product.deleted ||
      !product.active ||
      !product.tax_code
    )
      throw new BillingError("product_needs_managed_payments_setup")

    const open = await client.query<Attempt>(
      "select * from billing_attempts where user_id=$1 and state in ('preparing','open')",
      [buyer.id]
    )
    let attempt = open.rows[0]
    if (attempt?.session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        attempt.session_id
      )
      if (session.status === "complete")
        throw new BillingError("payment_confirmation_pending", 409)
      if (session.status === "open") {
        if (attempt.price_id !== priceId) {
          await stripe.checkout.sessions.expire(session.id)
          await client.query(
            "update billing_attempts set state='expired',checkout_url=null where id=$1",
            [attempt.id]
          )
          attempt = undefined
        } else
          return {
            attemptId: attempt.id,
            url: providerUrl(session.url, ["checkout.stripe.com"]),
          }
      } else {
        await client.query(
          "update billing_attempts set state='expired',checkout_url=null where id=$1",
          [attempt.id]
        )
        attempt = undefined
      }
    }
    if (attempt && attempt.price_id !== priceId)
      throw new BillingError("checkout_retry_original_choice", 409)
    if (attempt && Date.now() - attempt.created_at.getTime() > 23 * 3_600_000)
      throw new BillingError("checkout_needs_reconciliation")
    if (!attempt) {
      const result = await client.query<Attempt>(
        "insert into billing_attempts(id,user_id,plan,interval,price_id,terms_version) values($1,$2,$3,$4,$5,$6) returning *",
        [
          randomUUID(),
          buyer.id,
          choice.plan,
          choice.interval,
          priceId,
          choice.termsVersion,
        ]
      )
      attempt = result.rows[0]
    }
    if (!attempt) throw new BillingError("checkout_unavailable")
    const prefix = choice.locale === "en" ? "" : `/${choice.locale}`
    const origin = billingConfig().origin
    const params: ManagedCheckoutParams = {
      mode: "subscription",
      customer,
      managed_payments: { enabled: true },
      line_items: [{ price: attempt.price_id, quantity: 1 }],
      locale: choice.locale,
      client_reference_id: buyer.id,
      metadata: { lg_attempt_id: attempt.id },
      subscription_data: {
        metadata: { lg_user_id: buyer.id, lg_attempt_id: attempt.id },
      },
      success_url: `${origin}${prefix}/contribute/membership/checkout?attempt=${attempt.id}`,
      cancel_url: `${origin}${prefix}/contribute/membership/checkout?attempt=${attempt.id}&cancelled=1`,
    }
    // The attempt is durably stored before Stripe is called. After a timeout the
    // same idempotency key recovers the original session, including across instances.
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `lg-checkout:${attempt.id}`,
    })
    const url = providerUrl(session.url, ["checkout.stripe.com"])
    await client.query(
      "update billing_attempts set session_id=$2,checkout_url=$3,state='open',expires_at=$4 where id=$1",
      [attempt.id, session.id, url, new Date(session.expires_at * 1000)]
    )

    return { attemptId: attempt.id, url }
  })
}
