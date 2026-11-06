import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"

import type { SupportedLocale } from "@repo/shared-data"
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

import { apiConfig, apiOffer } from "./config"
import {
  API_DIMENSIONS,
  API_MONTHLY_PENCE,
  API_OVERAGE_TERMS_VERSION,
  API_TERMS_VERSION,
  validOverageCap,
} from "./constants"
import { overagePermitted } from "./period"
import { projectApiMembership } from "./projection"
import { apiSubscription, transaction } from "./store"
import type { ApiMembership, ApiOffer } from "./types"

type Attempt = {
  id: string
  price_id: string
  session_id: string | null
  created_at: Date
  actor_id: string
  offer: ApiOffer
  locale: SupportedLocale
}

const lockKey = (teamId: string) => `api-account:${teamId}`

export async function apiPrice(stripe: Stripe) {
  const config = apiConfig()
  if (!config.purchasing || !config.priceId)
    throw new BillingError("api_purchases_unavailable", 409)
  const price = await stripe.prices.retrieve(config.priceId, {
    expand: ["product"],
  })
  if (
    !price.active ||
    price.livemode !== (config.mode === "live") ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" ||
    price.unit_amount !== API_MONTHLY_PENCE ||
    price.currency !== "gbp" ||
    price.tax_behavior !== "inclusive" ||
    typeof price.product === "string" ||
    price.product.deleted ||
    !price.product.active ||
    !price.product.tax_code
  )
    throw new BillingError("api_price_unavailable")

  return price
}

/** A deterministic UUID so a retried individual checkout reuses one organisation. */
export function organisationRequestId(userId: string) {
  const hex = createHash("sha256")
    .update(`lg-api-organisation:${userId}`)
    .digest("hex")

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

async function ensureAccount(
  client: PoolClient,
  team: { documentId: string; name: string },
  email: string
) {
  const config = apiConfig()
  await client.query(
    "insert into api_accounts(team_id,mode,create_token,customer_payload) values($1,$2,$3,$4) on conflict do nothing",
    [
      team.documentId,
      config.mode,
      randomUUID(),
      { name: team.name, email, metadata: { lg_api_team_id: team.documentId } },
    ]
  )
  const account = (
    await client.query<{
      customer_id: string | null
      mode: string
      create_token: string
      created_at: Date
      closed_at: Date | null
      customer_payload: Stripe.CustomerCreateParams | null
    }>("select * from api_accounts where team_id=$1", [team.documentId])
  ).rows[0]!
  if (account.mode !== config.mode)
    throw new BillingError("billing_environment_mismatch")
  if (account.closed_at) throw new BillingError("api_account_closed", 403)

  return account
}

/**
 * Organisers buy one API subscription per organisation. No Team seat or paid
 * workspace state is required. The offer snapshot (version, Price, tax
 * behaviour, limits, overage rates/prices and consent) is fixed here.
 */
export async function apiCheckout(
  pool: Pool,
  stripe: Stripe,
  team: { documentId: string; name: string },
  buyer: { id: string; email: string },
  choice: { locale: SupportedLocale; termsVersion: string }
) {
  if (choice.termsVersion !== API_TERMS_VERSION)
    throw new BillingError("api_terms_required", 400)
  const price = await apiPrice(stripe),
    config = apiConfig()

  return withBillingLock(pool, lockKey(team.documentId), async (client) => {
    const account = await ensureAccount(client, team, buyer.email)
    let customer = account.customer_id
    if (!customer) {
      if (
        Date.now() - account.created_at.getTime() > 23 * 3_600_000 ||
        !account.customer_payload
      )
        throw new BillingError("api_customer_needs_reconciliation")
      const created = await stripe.customers.create(account.customer_payload, {
        idempotencyKey: `lg-api-customer:${account.create_token}`,
      })
      customer = created.id
      await client.query(
        "update api_accounts set customer_id=$2,customer_payload=null where team_id=$1",
        [team.documentId, customer]
      )
    }
    let attempt = (
      await client.query<Attempt>(
        "select * from api_attempts where team_id=$1 and state in ('preparing','open')",
        [team.documentId]
      )
    ).rows[0]
    if (attempt?.session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        attempt.session_id
      )
      if (session.status === "complete")
        throw new BillingError("api_payment_confirmation_pending", 409)
      if (session.status === "open" && attempt.price_id === price.id)
        return { url: providerUrl(session.url, ["checkout.stripe.com"]) }
      if (session.status === "open")
        await stripe.checkout.sessions.expire(session.id)
      await client.query(
        "update api_attempts set state='expired',checkout_url=null where id=$1",
        [attempt.id]
      )
      attempt = undefined
    }
    if (
      attempt &&
      (attempt.price_id !== price.id ||
        Date.now() - attempt.created_at.getTime() > 23 * 3_600_000)
    )
      throw new BillingError("api_checkout_needs_reconciliation")
    if (!attempt) {
      const subscriptions = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      })
      if (
        subscriptions.has_more ||
        subscriptions.data.some(
          (sub) => !["canceled", "incomplete_expired"].includes(sub.status)
        )
      )
        throw new BillingError("api_subscription_already_exists", 409)
      attempt = (
        await client.query<Attempt>(
          "insert into api_attempts(id,team_id,actor_id,price_id,offer,locale) values($1,$2,$3,$4,$5,$6) returning *",
          [
            randomUUID(),
            team.documentId,
            buyer.id,
            price.id,
            apiOffer(price.id),
            choice.locale,
          ]
        )
      ).rows[0]
    }
    if (!attempt) throw new BillingError("api_checkout_unavailable")
    const prefix = attempt.locale === "en" ? "" : `/${attempt.locale}`
    const back = `${config.origin}${prefix}/developers`
    const metadata = {
      lg_api_attempt_id: attempt.id,
      lg_api_team_id: team.documentId,
    }
    const params: ManagedCheckoutParams = {
      mode: "subscription",
      customer,
      managed_payments: { enabled: true },
      locale: attempt.locale,
      line_items: [{ price: attempt.price_id, quantity: 1 }],
      client_reference_id: team.documentId,
      metadata,
      subscription_data: { metadata },
      success_url: `${back}?payment=confirming`,
      cancel_url: `${back}?payment=cancelled`,
    }
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `lg-api-checkout:${attempt.id}`,
    })
    const url = providerUrl(session.url, ["checkout.stripe.com"])
    await client.query(
      "update api_attempts set session_id=$2,checkout_url=$3,state='open' where id=$1",
      [attempt.id, session.id, url]
    )

    return { url }
  })
}

/**
 * Refetch provider state and verify the persisted customer, checkout,
 * attempt and mode binding before projecting settled invoice lines. Returns
 * true only when this subscription belongs to a persisted API checkout.
 */
export async function refreshApiSubscription(
  pool: Pool,
  stripe: Stripe,
  id: string,
  reversal?: { revoke: boolean; reversedInvoice?: string }
) {
  const initial = await stripe.subscriptions.retrieve(id)
  const teamId = initial.metadata.lg_api_team_id
  if (!teamId) return false

  return withBillingLock(pool, lockKey(teamId), async (client) => {
    const subscription = await stripe.subscriptions.retrieve(id)
    if (subscription.metadata.lg_api_team_id !== teamId)
      throw new BillingError("api_subscription_binding_invalid")
    if (subscription.livemode !== (apiConfig().mode === "live"))
      throw new BillingError("subscription_environment_mismatch")
    const account = (
      await client.query<{ mode: string; customer_id: string }>(
        "select mode,customer_id from api_accounts where team_id=$1",
        [teamId]
      )
    ).rows[0]
    if (!account) return false
    if (
      account.mode !== apiConfig().mode ||
      account.customer_id !== stripeId(subscription.customer)
    )
      throw new BillingError("api_subscription_binding_invalid")
    const attempt = (
      await client.query<Attempt>(
        "select * from api_attempts where id::text=$1 and team_id=$2",
        [subscription.metadata.lg_api_attempt_id ?? "", teamId]
      )
    ).rows[0]
    if (!attempt?.session_id)
      throw new BillingError("api_subscription_binding_pending")
    const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
    if (
      !isManagedCheckout(session) ||
      stripeId(session.subscription) !== id ||
      stripeId(session.customer) !== account.customer_id ||
      session.client_reference_id !== teamId ||
      session.metadata?.lg_api_attempt_id !== attempt.id ||
      session.metadata?.lg_api_team_id !== teamId
    )
      throw new BillingError("api_subscription_binding_invalid")
    const previousRow = (
      await client.query<{ snapshot: ApiMembership }>(
        "select snapshot from api_subscriptions where subscription_id=$1",
        [id]
      )
    ).rows[0]
    const previous = previousRow?.snapshot ?? null
    const invoices = await stripe.invoices.list({
      subscription: id,
      status: "paid",
      limit: 10,
    })
    const snapshot = projectApiMembership(
      subscription,
      invoices.data,
      previous,
      attempt.offer
    )
    if (
      reversal?.revoke &&
      invoices.data.some(
        (invoice) =>
          invoice.id === reversal.reversedInvoice &&
          invoice.lines.data.some(
            (line) =>
              new Date(line.period.end * 1000).toISOString() ===
              snapshot.paidThrough
          )
      )
    )
      snapshot.revoked = true
    // jsonb reorders keys; compare values so a replay keeps its revision.
    if (!previous)
      await client.query(
        "insert into api_subscriptions(subscription_id,team_id,snapshot) values($1,$2,$3)",
        [id, teamId, snapshot]
      )
    else if (!isDeepStrictEqual(previous, snapshot))
      await client.query(
        "update api_subscriptions set snapshot=$2,revision=revision+1,reconciled_at=now() where subscription_id=$1",
        [id, snapshot]
      )
    else
      await client.query(
        "update api_subscriptions set reconciled_at=now() where subscription_id=$1",
        [id]
      )
    await client.query(
      "update api_attempts set state='complete',subscription_id=$2,checkout_url=null where id=$1",
      [attempt.id, id]
    )

    return true
  })
}

export async function reconcileApiAttempts(
  pool: Pool,
  stripe: Stripe,
  withinBudget: () => boolean
) {
  let failed = 0
  const attempts = await pool.query<{ id: string; session_id: string }>(
    "select id,session_id from api_attempts where state='open' and session_id is not null order by reconciled_at limit 10"
  )
  for (const attempt of attempts.rows) {
    if (!withinBudget()) break
    try {
      const session = await stripe.checkout.sessions.retrieve(
        attempt.session_id
      )
      const id = stripeId(session.subscription)
      if (session.status === "complete" && id)
        await refreshApiSubscription(pool, stripe, id)
      if (session.status === "expired")
        await pool.query(
          "update api_attempts set state='expired',checkout_url=null where id=$1",
          [attempt.id]
        )
    } catch {
      failed++
    }
    await pool.query(
      "update api_attempts set reconciled_at=now() where id=$1",
      [attempt.id]
    )
  }
  const stale = await pool.query<{ subscription_id: string }>(
    "select subscription_id from api_subscriptions where reconciled_at<now()-interval '15 minutes' order by reconciled_at limit 10"
  )
  for (const row of stale.rows) {
    if (!withinBudget()) break
    try {
      await refreshApiSubscription(pool, stripe, row.subscription_id)
    } catch {
      failed++
      await pool.query(
        "update api_subscriptions set reconciled_at=now() where subscription_id=$1",
        [row.subscription_id]
      )
    }
  }

  return failed
}

export async function apiPortal(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  locale: string
) {
  const config = apiConfig()
  if (!config.portalId) throw new BillingError("api_portal_unavailable")
  const account = (
    await pool.query<{ customer_id: string; mode: string }>(
      "select customer_id,mode from api_accounts where team_id=$1",
      [teamId]
    )
  ).rows[0]
  if (!account?.customer_id || account.mode !== config.mode)
    throw new BillingError("api_billing_not_found", 404)
  const portal = await stripe.billingPortal.configurations.retrieve(
    config.portalId
  )
  if (
    !portal.active ||
    portal.livemode !== (config.mode === "live") ||
    portal.features.subscription_update.enabled ||
    !portal.features.subscription_cancel.enabled ||
    portal.features.subscription_cancel.mode !== "at_period_end"
  )
    throw new BillingError("api_portal_configuration_invalid")
  const session = await stripe.billingPortal.sessions.create({
    customer: account.customer_id,
    configuration: config.portalId,
    return_url: `${config.origin}${locale === "en" ? "" : `/${locale}`}/developers`,
  })

  return { url: providerUrl(session.url, ["billing.stripe.com"]) }
}

export type OverageChoice =
  | { enabled: true; capPence: number; termsVersion: string }
  | { enabled: false }

/**
 * Organiser opt-in, cap change or opt-out. Enabling needs `API_OVERAGE_ENABLED`,
 * fresh consent, a settled period in good standing and the offer's metered
 * Prices on the subscription (added here, without proration). Every change is
 * versioned in `api_overage_changes`. Lowering the cap below accrued charges,
 * or turning overage off, stops further paid usage and erases nothing.
 */
export async function setApiOverage(
  pool: Pool,
  stripe: Stripe,
  teamId: string,
  actorId: string,
  choice: OverageChoice
) {
  const config = apiConfig()
  if (choice.enabled) {
    if (!config.overage) throw new BillingError("api_overage_unavailable", 409)
    if (choice.termsVersion !== API_OVERAGE_TERMS_VERSION)
      throw new BillingError("api_overage_terms_required", 400)
    if (!validOverageCap(choice.capPence))
      throw new BillingError("invalid_overage_cap", 400)
  }

  return withBillingLock(pool, lockKey(teamId), async () => {
    if (choice.enabled) {
      const subscription = await apiSubscription(pool, teamId)
      const membership = subscription?.membership
      if (!subscription || !membership)
        throw new BillingError("api_access_required", 403)
      const prices = membership.offer.overagePrices
      if (API_DIMENSIONS.some((d) => !prices[d]))
        throw new BillingError("api_overage_unavailable", 409)
      if (membership.status !== "active" || membership.revoked)
        throw new BillingError("api_overage_standing_required", 409)
      let added = false
      for (const dimension of API_DIMENSIONS) {
        if (membership.overageItems[dimension]) continue
        await stripe.subscriptionItems.create(
          {
            subscription: subscription.subscriptionId,
            price: prices[dimension]!,
            proration_behavior: "none",
            metadata: { lg_api_team_id: teamId, lg_api_dimension: dimension },
          },
          {
            idempotencyKey: `lg-api-overage-item:${subscription.subscriptionId}:${dimension}`,
          }
        )
        added = true
      }
      if (added)
        await refreshApiSubscriptionUnlocked(
          pool,
          stripe,
          subscription.subscriptionId
        )
      const refreshed = await apiSubscription(pool, teamId)
      if (!overagePermitted(refreshed?.membership, config.mode, new Date()))
        throw new BillingError("api_overage_unavailable", 409)
    }

    return transaction(pool, async (client) => {
      const account = (
        await client.query<{
          overage_enabled: boolean
          overage_cap_pence: number
          overage_revision: number
        }>(
          "select overage_enabled,overage_cap_pence,overage_revision from api_accounts where team_id=$1 for update",
          [teamId]
        )
      ).rows[0]
      if (!account) throw new BillingError("api_billing_not_found", 404)
      const enabled = choice.enabled
      const cap = choice.enabled ? choice.capPence : account.overage_cap_pence
      if (
        enabled === account.overage_enabled &&
        cap === account.overage_cap_pence
      )
        return { enabled, capPence: cap, revision: account.overage_revision }
      const revision = account.overage_revision + 1
      await client.query(
        "update api_accounts set overage_enabled=$2,overage_cap_pence=$3,overage_revision=$4,overage_updated_at=now() where team_id=$1",
        [teamId, enabled, cap, revision]
      )
      await client.query(
        "insert into api_overage_changes(team_id,revision,actor_id,enabled,cap_pence,terms_version,rates) values($1,$2,$3,$4,$5,$6,$7)",
        [
          teamId,
          revision,
          actorId,
          enabled,
          cap,
          choice.enabled ? choice.termsVersion : null,
          config.rates,
        ]
      )

      return { enabled, capPence: cap, revision }
    })
  })
}

/**
 * Record the subscription's metered overage items. The caller already holds
 * this account's billing lock (a try-lock, so `refreshApiSubscription` would
 * refuse here); the worker's next full refresh re-verifies the binding.
 */
async function refreshApiSubscriptionUnlocked(
  pool: Pool,
  stripe: Stripe,
  id: string
) {
  const subscription = await stripe.subscriptions.retrieve(id)
  const row = (
    await pool.query<{ snapshot: ApiMembership }>(
      "select snapshot from api_subscriptions where subscription_id=$1",
      [id]
    )
  ).rows[0]
  if (!row) return
  const offer = row.snapshot.offer
  const items = Object.fromEntries(
    subscription.items.data.flatMap((item) => {
      const dimension = API_DIMENSIONS.find(
        (d) => offer.overagePrices[d] === item.price.id
      )

      return dimension ? [[dimension, item.id]] : []
    })
  )
  const snapshot = { ...row.snapshot, overageItems: items }
  if (!isDeepStrictEqual(snapshot, row.snapshot))
    await pool.query(
      "update api_subscriptions set snapshot=$2,revision=revision+1 where subscription_id=$1",
      [id, snapshot]
    )
}
