import "server-only"

import { randomUUID } from "node:crypto"

import type { Pool } from "pg"
import type Stripe from "stripe"

import { BillingError } from "@/lib/billing/config"
import { withBillingLock } from "@/lib/billing/database"
import {
  isManagedCheckout,
  providerUrl,
  stripeId,
  type ManagedCheckoutParams,
} from "@/lib/billing/provider"

import { apiConfig, API_TERMS_VERSION } from "./config"
import { projectApiMembership } from "./projection"
import type { ApiLimits, ApiMembership } from "./types"

type Attempt = {
  id: string
  price_id: string
  session_id: string | null
  created_at: Date
  actor_id: string
  limits: ApiLimits
  locale: "en" | "cs" | "fr"
}

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
    price.unit_amount === null ||
    price.unit_amount <= 0 ||
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

export async function apiCheckout(
  pool: Pool,
  stripe: Stripe,
  team: { documentId: string; name: string },
  buyer: { id: string; email: string; name: string },
  choice: { locale: "en" | "fr" | "cs"; termsVersion: string }
) {
  if (choice.termsVersion !== API_TERMS_VERSION)
    throw new BillingError("api_terms_required", 400)
  const price = await apiPrice(stripe),
    config = apiConfig()

  return withBillingLock(
    pool,
    `api-team:${team.documentId}`,
    async (client) => {
      // Discard holds this same lock through CMS archival and the durable marker.
      const archived = await client.query(
        "select 1 from team_billing_accounts where team_id=$1 and archived_at is not null",
        [team.documentId]
      )
      if (archived.rowCount) throw new BillingError("team_inactive", 403)
      await client.query(
        "insert into team_api_accounts(team_id,mode,create_token,customer_payload) values($1,$2,$3,$4) on conflict do nothing",
        [
          team.documentId,
          config.mode,
          randomUUID(),
          {
            name: team.name,
            email: buyer.email,
            metadata: { lg_api_team_id: team.documentId },
          },
        ]
      )
      const query = await client.query<{
        customer_id: string | null
        mode: string
        create_token: string
        created_at: Date
        customer_payload: Stripe.CustomerCreateParams | null
      }>("select * from team_api_accounts where team_id=$1", [team.documentId])
      const account = query.rows[0]!
      if (account.mode !== config.mode)
        throw new BillingError("billing_environment_mismatch")
      let customer = account.customer_id
      if (!customer) {
        if (Date.now() - account.created_at.getTime() > 23 * 3_600_000)
          throw new BillingError("api_customer_needs_reconciliation")
        if (!account.customer_payload)
          throw new BillingError("api_customer_needs_reconciliation")
        const created = await stripe.customers.create(
          account.customer_payload,
          { idempotencyKey: `lg-api-customer:${account.create_token}` }
        )
        customer = created.id
        await client.query(
          "update team_api_accounts set customer_id=$2,customer_payload=null where team_id=$1",
          [team.documentId, customer]
        )
      }
      let attempt = (
        await client.query<Attempt>(
          "select * from team_api_attempts where team_id=$1 and state in ('preparing','open')",
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
          "update team_api_attempts set state='expired',checkout_url=null where id=$1",
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
            "insert into team_api_attempts(id,team_id,actor_id,price_id,terms_version,limits,locale) values($1,$2,$3,$4,$5,$6,$7) returning *",
            [
              randomUUID(),
              team.documentId,
              buyer.id,
              price.id,
              API_TERMS_VERSION,
              config.limits,
              choice.locale,
            ]
          )
        ).rows[0]
      }
      if (!attempt) throw new BillingError("api_checkout_unavailable")
      const prefix = attempt.locale === "en" ? "" : `/${attempt.locale}`
      const back = `${config.origin}${prefix}/staff/team/api?team=${team.documentId}`
      const params: ManagedCheckoutParams = {
        mode: "subscription",
        customer,
        managed_payments: { enabled: true },
        locale: attempt.locale,
        line_items: [{ price: attempt.price_id, quantity: 1 }],
        client_reference_id: team.documentId,
        metadata: {
          lg_api_attempt_id: attempt.id,
          lg_api_team_id: team.documentId,
        },
        subscription_data: {
          metadata: {
            lg_api_attempt_id: attempt.id,
            lg_api_team_id: team.documentId,
          },
        },
        success_url: `${back}&payment=confirming`,
        cancel_url: `${back}&payment=cancelled`,
      }
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `lg-api-checkout:${attempt.id}`,
      })
      const url = providerUrl(session.url, ["checkout.stripe.com"])
      await client.query(
        "update team_api_attempts set session_id=$2,checkout_url=$3,state='open' where id=$1",
        [attempt.id, session.id, url]
      )

      return { url }
    }
  )
}

/** Returns true only when this subscription belongs to a persisted Team checkout. */
export async function refreshApiSubscription(
  pool: Pool,
  stripe: Stripe,
  id: string,
  reversal?: { revoke: boolean; reversedInvoice?: string }
) {
  const subscription = await stripe.subscriptions.retrieve(id, {
    expand: ["latest_invoice"],
  })
  const teamId = subscription.metadata.lg_api_team_id
  if (!teamId) return false

  return withBillingLock(pool, `api-team:${teamId}`, async (client) => {
    if (subscription.livemode !== (apiConfig().mode === "live"))
      throw new BillingError("subscription_environment_mismatch")
    const account = (
      await client.query<{ mode: string; customer_id: string }>(
        "select mode,customer_id from team_api_accounts where team_id=$1",
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
        "select * from team_api_attempts where id::text=$1 and team_id=$2",
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
    const previous =
      (
        await client.query<{ snapshot: ApiMembership }>(
          "select snapshot from team_api_memberships where subscription_id=$1",
          [id]
        )
      ).rows[0]?.snapshot ?? null
    const invoices = await stripe.invoices.list({
      subscription: id,
      status: "paid",
      limit: 10,
    })
    const snapshot = projectApiMembership(
      subscription,
      invoices.data,
      previous,
      attempt.price_id,
      attempt.limits
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
    await client.query(
      "insert into team_api_memberships(subscription_id,team_id,snapshot) values($1,$2,$3) on conflict(subscription_id) do update set snapshot=excluded.snapshot,reconciled_at=now()",
      [id, teamId, snapshot]
    )
    await client.query(
      "update team_api_attempts set state='complete',subscription_id=$2,checkout_url=null where id=$1",
      [attempt.id, id]
    )

    return true
  })
}

export async function reconcileApiBilling(
  pool: Pool,
  stripe: Stripe,
  withinBudget: () => boolean
) {
  let failed = 0
  const attempts = await pool.query<{ id: string; session_id: string }>(
    "select id,session_id from team_api_attempts where state='open' and session_id is not null order by reconciled_at limit 10"
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
          "update team_api_attempts set state='expired',checkout_url=null where id=$1",
          [attempt.id]
        )
    } catch {
      failed++
    }
    await pool.query(
      "update team_api_attempts set reconciled_at=now() where id=$1",
      [attempt.id]
    )
  }
  const stale = await pool.query<{ subscription_id: string }>(
    "select subscription_id from team_api_memberships where reconciled_at<now()-interval '15 minutes' order by reconciled_at limit 10"
  )
  for (const row of stale.rows) {
    if (!withinBudget()) break
    try {
      await refreshApiSubscription(pool, stripe, row.subscription_id)
    } catch {
      failed++
      await pool.query(
        "update team_api_memberships set reconciled_at=now() where subscription_id=$1",
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
      "select customer_id,mode from team_api_accounts where team_id=$1",
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
    return_url: `${config.origin}${locale === "en" ? "" : `/${locale}`}/staff/team/api?team=${teamId}`,
  })

  return { url: providerUrl(session.url, ["billing.stripe.com"]) }
}
