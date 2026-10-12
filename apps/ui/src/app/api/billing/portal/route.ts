import { authDbPool } from "@/lib/auth"
import { BillingError, billingConfig } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe, providerUrl } from "@/lib/billing/provider"

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
    const portal = await billingStripe().billingPortal.sessions.create({
      customer: account.customer_id,
      configuration: billingConfig().portalConfiguration,
      return_url: `${billingConfig().origin}/profile/settings#membership`,
    })

    return billingJson({ url: providerUrl(portal.url, ["billing.stripe.com"]) })
  } catch (error) {
    return billingFailure(error)
  }
}
