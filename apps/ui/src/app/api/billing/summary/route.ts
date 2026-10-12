import { isPaidMembership } from "@repo/access"

import { authDbPool } from "@/lib/auth"
import { billingConfig } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { providerOverview } from "@/lib/billing/overview"
import { billingStripe } from "@/lib/billing/provider"

export const runtime = "nodejs"
export async function GET(req: Request) {
  try {
    const user = await billingUser(req)
    const config = billingConfig()
    const result = await authDbPool.query<{
      snapshot: unknown
      subscription_id: string
      revision: string
      synced_revision: string
    }>(
      "select snapshot,subscription_id,revision,synced_revision from billing_memberships where user_id=$1 order by snapshot->>'memberSince' desc,updated_at desc limit 1",
      [user.id]
    )
    const account = await authDbPool.query<{
      customer_id: string | null
      erased_at: Date | null
      deleting: boolean
      mode: string
      confirmation_pending: boolean
    }>(
      "select customer_id,erased_at,deleting,mode,exists(select 1 from billing_attempts a where a.user_id=billing_accounts.user_id and a.state in ('preparing','open') and (a.expires_at is null or a.expires_at>now())) as confirmation_pending from billing_accounts where user_id=$1",
      [user.id]
    )
    const customer = account.rows[0]
    const invoices =
      customer?.customer_id &&
      !customer.erased_at &&
      !customer.deleting &&
      customer.mode === config.mode &&
      config.configured
        ? (
            await billingStripe().invoices.list({
              customer: customer.customer_id,
              limit: 12,
            })
          ).data.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            description:
              invoice.description ??
              invoice.lines.data.find((line) => line.amount > 0)?.description ??
              invoice.lines.data[0]?.description ??
              null,
            created: invoice.created,
            currency: invoice.currency,
            total: invoice.total,
            status: invoice.status,
            pdf: invoice.invoice_pdf,
          }))
        : []

    const snapshot = result.rows[0]?.snapshot
    const membership =
      isPaidMembership(snapshot) && snapshot.mode === config.mode
        ? snapshot
        : null
    const canManage = Boolean(
      customer?.customer_id &&
      !customer.erased_at &&
      !customer.deleting &&
      customer.mode === config.mode &&
      config.configured
    )
    const overview =
      canManage && result.rows[0]?.subscription_id && customer?.customer_id
        ? await providerOverview(
            billingStripe(),
            result.rows[0].subscription_id,
            customer.customer_id,
            config.mode
          )
        : {
            paymentMethod: null,
            billingDetails: null,
            foundingPrice: false,
            nextAttempt: null,
          }

    return billingJson({
      ...overview,
      membership,
      confirmationPending:
        canManage &&
        Boolean(
          membership
            ? result.rows[0]?.revision !== result.rows[0]?.synced_revision
            : customer?.confirmation_pending &&
                invoices.some((invoice) => invoice.status === "paid")
        ),
      effectivePlan: user.plan ?? "free",
      accessSource: user.planSource ?? "none",
      invoices,
      canManage,
      available: config.enabled,
    })
  } catch (error) {
    return billingFailure(error)
  }
}
