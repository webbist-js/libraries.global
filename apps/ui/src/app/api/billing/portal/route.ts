import { authDbPool } from "@/lib/auth"
import { BillingError, billingConfig, planForPrice } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe, providerUrl, stripeId } from "@/lib/billing/provider"

export const runtime = "nodejs"
export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    const result = await authDbPool.query<{
      customer_id: string | null
      deleting: boolean
      erased_at: Date | null
      mode: string
    }>(
      "select customer_id,deleting,erased_at,mode from billing_accounts where user_id=$1",
      [user.id]
    )
    const account = result.rows[0]
    if (!account?.customer_id || account.deleting || account.erased_at)
      throw new BillingError("billing_account_not_found", 404)
    if (account.mode !== billingConfig().mode)
      throw new BillingError("billing_environment_mismatch")
    const stripe = billingStripe()
    const memberships = await authDbPool.query<{ subscription_id: string }>(
      "select subscription_id from billing_memberships where user_id=$1 order by snapshot->>'memberSince' desc limit 1",
      [user.id]
    )
    const subscriptionId = memberships.rows[0]?.subscription_id
    let configuration = billingConfig().portalConfiguration
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["latest_invoice"],
      })
      if (
        stripeId(subscription.customer) !== account.customer_id ||
        subscription.metadata.lg_user_id !== user.id ||
        subscription.livemode !== (billingConfig().mode === "live")
      )
        throw new BillingError("subscription_binding_invalid")
      if (
        planForPrice(subscription.items.data[0]?.price.id ?? "")?.plan ===
        "supporter"
      )
        configuration = billingConfig().supporterPortalConfiguration
      const invoice = subscription.latest_invoice
      if (
        subscription.status === "past_due" ||
        subscription.status === "unpaid" ||
        (invoice &&
          typeof invoice !== "string" &&
          invoice.status !== "paid" &&
          invoice.amount_due > 0)
      )
        configuration = billingConfig().recoveryPortalConfiguration
    }
    if (!configuration)
      throw new BillingError("portal_configuration_unavailable")
    const portal = await stripe.billingPortal.sessions.create({
      customer: account.customer_id,
      configuration,
      return_url: `${billingConfig().origin}/map?account=membership`,
    })

    return billingJson({ url: providerUrl(portal.url, ["billing.stripe.com"]) })
  } catch (error) {
    return billingFailure(error)
  }
}
