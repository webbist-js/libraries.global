import "server-only"

import { randomUUID } from "node:crypto"

import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { withBillingLock } from "@/lib/billing/database"
import {
  isManagedCheckout,
  providerUrl,
  stripeId,
  type ManagedCheckoutParams,
} from "@/lib/billing/provider"
import pricing from "@/lib/membership-pricing.json"

import { teamBillingBridge } from "./bridge"
import { teamBillingConfig } from "./config"
import { MAX_TEAM_SEATS, MIN_TEAM_SEATS, TEAM_TERMS_VERSION } from "./types"

type Buyer = { id: string; email: string; name?: string | null }

export type TeamBillingAccount = {
  id: string
  team_id: string | null
  creator_id: string
  name: string
  mode: string
  customer_id: string | null
  customer_payload: Stripe.CustomerCreateParams | null
  customer_started_at: Date | null
  archived_at: Date | null
}
export type TeamCheckoutAttempt = {
  id: string
  account_id: string
  price_id: string
  seats: number
  terms_version: string
  locale: "en" | "fr" | "cs"
  session_id: string | null
  created_at: Date
}
export type TeamBillingContext = {
  accountId: string
  teamId: string
  name: string
  discounted: boolean
  used: number
}

export async function createSelfServiceTeam(
  pool: Pool,
  buyer: Buyer,
  input: { requestId: string; name: string; publicServiceRequested?: boolean }
) {
  const config = teamBillingConfig()
  if (!config.purchasing)
    throw new BillingError("team_purchases_unavailable", 409)

  return withBillingLock(pool, `user:${buyer.id}`, async (client) => {
    const identity = await client.query(
      'select id from "user" where id=$1 and "emailVerified"=true',
      [buyer.id]
    )
    if (!identity.rowCount)
      throw new BillingError("verified_account_required", 403)
    if (
      (
        await client.query(
          "select 1 from team_billing_erasing_users where user_id=$1",
          [buyer.id]
        )
      ).rowCount
    )
      throw new BillingError("account_deletion_pending", 409)
    let account = (
      await client.query<TeamBillingAccount>(
        "select * from team_billing_accounts where id=$1",
        [input.requestId]
      )
    ).rows[0]
    if (
      account &&
      (account.archived_at !== null ||
        account.creator_id !== buyer.id ||
        account.mode !== config.mode ||
        account.name !== input.name)
    )
      throw new BillingError("team_signup_conflict", 409)
    if (!account) {
      const count = await client.query<{ count: string }>(
        "select count(*) from team_billing_accounts where creator_id=$1 and archived_at is null",
        [buyer.id]
      )
      if (Number(count.rows[0]?.count) >= 10)
        throw new BillingError("team_limit_reached", 409)
      account = (
        await client.query<TeamBillingAccount>(
          "insert into team_billing_accounts(id,creator_id,name,mode) values($1,$2,$3,$4) returning *",
          [input.requestId, buyer.id, input.name, config.mode]
        )
      ).rows[0]!
    }
    if (!account.team_id) {
      const created = await teamBillingBridge<{ teamId: string }>("create", {
        accountId: account.id,
        mode: config.mode,
        name: account.name,
        baUserId: buyer.id,
        email: buyer.email,
        publicServiceRequested: input.publicServiceRequested === true,
      })
      await client.query(
        "update team_billing_accounts set team_id=$2 where id=$1",
        [account.id, created.teamId]
      )
      account.team_id = created.teamId
    }

    return { teamId: account.team_id }
  })
}

export async function teamContext(teamId: string, buyer: Buyer) {
  return teamBillingBridge<TeamBillingContext>("context", {
    teamId,
    baUserId: buyer.id,
    mode: teamBillingConfig().mode,
  })
}

export async function teamSeatPrice(stripe: Stripe, discounted: boolean) {
  const config = teamBillingConfig()
  const id = discounted ? config.publicSeatPrice : config.seatPrice
  if (!config.purchasing || !id)
    throw new BillingError("team_purchases_unavailable", 409)
  const price = await stripe.prices.retrieve(id, { expand: ["product"] })
  const amount =
    pricing.team.extraSeatYear *
    (discounted ? (100 - pricing.team.publicServiceDiscountPercent) / 100 : 1)
  if (
    !price.active ||
    price.livemode !== (config.mode === "live") ||
    price.currency !== "gbp" ||
    price.unit_amount !== amount ||
    price.tax_behavior !== "exclusive" ||
    price.recurring?.interval !== "year" ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" ||
    typeof price.product === "string" ||
    price.product.deleted ||
    !price.product.active ||
    stripeId(price.product.tax_code) !== "txcd_10103001" ||
    price.product.metadata.lg_feature !== "team_seats"
  )
    throw new BillingError("team_price_unavailable")

  return price
}

async function teamCustomer(
  client: PoolClient,
  stripe: Stripe,
  account: TeamBillingAccount,
  buyer: Buyer,
  name: string
) {
  if (account.customer_id) return account.customer_id
  if (!account.customer_started_at) {
    account.customer_payload = {
      name,
      email: buyer.email,
      metadata: { lg_team_billing_id: account.id },
    }
    const saved = await client.query<{ customer_started_at: Date }>(
      "update team_billing_accounts set customer_payload=$2,customer_started_at=now() where id=$1 returning customer_started_at",
      [account.id, account.customer_payload]
    )
    account.customer_started_at = saved.rows[0]!.customer_started_at
  }
  if (
    !account.customer_payload ||
    Date.now() - account.customer_started_at.getTime() > 23 * 3_600_000
  )
    throw new BillingError("team_customer_needs_reconciliation")
  const customer = await stripe.customers.create(account.customer_payload, {
    idempotencyKey: `lg-team-customer:${account.id}`,
  })
  await client.query(
    "update team_billing_accounts set customer_id=$2,customer_payload=null where id=$1",
    [account.id, customer.id]
  )

  return customer.id
}

function matchingOpenCheckout(
  session: Stripe.Checkout.Session,
  attempt: TeamCheckoutAttempt,
  priceId: string,
  seats: number
) {
  return (
    session.status === "open" &&
    attempt.price_id === priceId &&
    attempt.seats === seats &&
    attempt.terms_version === TEAM_TERMS_VERSION
  )
}

function assertReusableAttempt(
  attempt: TeamCheckoutAttempt | undefined,
  priceId: string,
  seats: number
) {
  if (
    attempt &&
    (attempt.price_id !== priceId ||
      attempt.seats !== seats ||
      attempt.terms_version !== TEAM_TERMS_VERSION ||
      Date.now() - attempt.created_at.getTime() > 23 * 3_600_000)
  )
    throw new BillingError("team_checkout_needs_reconciliation", 409)
}

export async function teamCheckout(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  buyer: Buyer,
  choice: { seats: number; locale: "en" | "fr" | "cs"; termsVersion: string }
) {
  if (choice.termsVersion !== TEAM_TERMS_VERSION)
    throw new BillingError("team_terms_required", 400)
  if (
    !Number.isSafeInteger(choice.seats) ||
    choice.seats < MIN_TEAM_SEATS ||
    choice.seats > MAX_TEAM_SEATS
  )
    throw new BillingError("invalid_team_seats", 400)
  const context = await teamContext(teamId, buyer)
  const price = await teamSeatPrice(stripe, context.discounted)
  const config = teamBillingConfig()

  return withBillingLock(
    pool,
    `team-billing:${context.accountId}`,
    async (client) => {
      const account = (
        await client.query<TeamBillingAccount>(
          "select * from team_billing_accounts where id=$1 and team_id=$2 and archived_at is null",
          [context.accountId, teamId]
        )
      ).rows[0]
      if (!account || account.mode !== config.mode)
        throw new BillingError("team_billing_not_found", 404)
      if (choice.seats < context.used)
        throw new BillingError("team_seats_occupied", 409)
      const customer = await teamCustomer(
        client,
        stripe,
        account,
        buyer,
        context.name
      )
      let attempt = (
        await client.query<TeamCheckoutAttempt>(
          "select * from team_billing_attempts where account_id=$1 and state in ('preparing','open')",
          [account.id]
        )
      ).rows[0]
      if (attempt?.session_id) {
        const session = await stripe.checkout.sessions.retrieve(
          attempt.session_id
        )
        if (session.status === "complete")
          throw new BillingError("team_payment_confirmation_pending", 409)
        if (matchingOpenCheckout(session, attempt, price.id, choice.seats))
          return { url: providerUrl(session.url, ["checkout.stripe.com"]) }
        if (session.status === "open")
          await stripe.checkout.sessions.expire(session.id)
        await client.query(
          "update team_billing_attempts set state='expired',checkout_url=null where id=$1",
          [attempt.id]
        )
        attempt = undefined
      }
      assertReusableAttempt(attempt, price.id, choice.seats)
      if (!attempt) {
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
          throw new BillingError("team_subscription_already_exists", 409)
        const coverage = await client.query(
          "select 1 from team_billing_memberships where account_id=$1 and (snapshot->>'accessUntil')::timestamptz>now() limit 1",
          [account.id]
        )
        if (coverage.rowCount)
          throw new BillingError("team_subscription_already_exists", 409)
        attempt = (
          await client.query<TeamCheckoutAttempt>(
            "insert into team_billing_attempts(id,account_id,actor_id,price_id,seats,terms_version,locale) values($1,$2,$3,$4,$5,$6,$7) returning *",
            [
              randomUUID(),
              account.id,
              buyer.id,
              price.id,
              choice.seats,
              TEAM_TERMS_VERSION,
              choice.locale,
            ]
          )
        ).rows[0]!
      }
      const back = `${config.origin}${attempt.locale === "en" ? "" : `/${attempt.locale}`}/staff/team/billing?team=${teamId}`
      const metadata = {
        lg_team_billing_id: account.id,
        lg_team_id: teamId,
        lg_team_attempt_id: attempt.id,
      }
      const params: ManagedCheckoutParams = {
        mode: "subscription",
        customer,
        managed_payments: { enabled: true },
        locale: attempt.locale,
        line_items: [{ price: attempt.price_id, quantity: attempt.seats }],
        client_reference_id: account.id,
        metadata,
        subscription_data: { metadata },
        success_url: `${back}&payment=confirming`,
        cancel_url: `${back}&payment=cancelled`,
      }
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `lg-team-checkout:${attempt.id}`,
      })
      const url = providerUrl(session.url, ["checkout.stripe.com"])
      // A provider response is not access. The worker independently verifies settlement.
      await client.query(
        "update team_billing_attempts set session_id=$2,checkout_url=$3,state='open' where id=$1",
        [attempt.id, session.id, url]
      )

      return { url }
    }
  )
}

/** Validate all Portal quantity controls before issuing its bearer capability. */
export function validateTeamPortal(
  portal: Stripe.BillingPortal.Configuration,
  priceId: string,
  mode: string
) {
  const update = portal.features.subscription_update
  const product = update.products?.[0]
  if (
    !portal.active ||
    portal.livemode !== (mode === "live") ||
    !portal.features.subscription_cancel.enabled ||
    portal.features.subscription_cancel.mode !== "at_period_end" ||
    !portal.features.invoice_history.enabled ||
    !portal.features.payment_method_update.enabled ||
    !update.enabled ||
    update.proration_behavior !== "always_invoice" ||
    update.default_allowed_updates.length !== 1 ||
    update.default_allowed_updates[0] !== "quantity" ||
    update.products?.length !== 1 ||
    product?.prices.length !== 1 ||
    product.prices[0] !== priceId ||
    !product.adjustable_quantity?.enabled ||
    product.adjustable_quantity.minimum !== MIN_TEAM_SEATS ||
    product.adjustable_quantity.maximum !== MAX_TEAM_SEATS ||
    !update.schedule_at_period_end.conditions.some(
      (c) => c.type === "decreasing_item_amount"
    )
  )
    throw new BillingError("team_portal_configuration_invalid")
}

export async function teamPortal(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  buyer: Buyer,
  locale: string
) {
  const context = await teamContext(teamId, buyer)
  const config = teamBillingConfig()
  const account = (
    await pool.query<TeamBillingAccount>(
      "select * from team_billing_accounts where id=$1 and team_id=$2 and archived_at is null",
      [context.accountId, teamId]
    )
  ).rows[0]
  if (!account?.customer_id || account.mode !== config.mode)
    throw new BillingError("team_billing_not_found", 404)
  const row = (
    await pool.query<{ snapshot: { priceId: string } }>(
      "select snapshot from team_billing_memberships where account_id=$1 order by revision desc,reconciled_at desc limit 1",
      [account.id]
    )
  ).rows[0]
  if (!row) throw new BillingError("team_payment_confirmation_pending", 409)
  // The original subscription's price, not a later eligibility/default change, selects its Portal.
  const publicPrice = row.snapshot.priceId === config.publicSeatPrice
  const portalId = publicPrice ? config.publicPortal : config.portal
  if (!portalId) throw new BillingError("team_portal_unavailable")
  const portal = await stripe.billingPortal.configurations.retrieve(portalId, {
    expand: ["features.subscription_update.products"],
  })
  validateTeamPortal(portal, row.snapshot.priceId, config.mode)
  const session = await stripe.billingPortal.sessions.create({
    customer: account.customer_id,
    configuration: portalId,
    locale: locale as "en" | "fr" | "cs",
    return_url: `${config.origin}${locale === "en" ? "" : `/${locale}`}/staff/team/billing?team=${teamId}&payment=updated`,
  })

  return { url: providerUrl(session.url, ["billing.stripe.com"]) }
}

export { isManagedCheckout }
