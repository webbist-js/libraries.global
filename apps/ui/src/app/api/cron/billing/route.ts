import { authDbPool } from "@/lib/auth"
import { isCronRequest } from "@/lib/auth-retention"
import { billingConfig } from "@/lib/billing/config"
import { runBillingWorker } from "@/lib/billing/events"
import { billingFailure, billingJson } from "@/lib/billing/http"
import { finishPlanChanges } from "@/lib/billing/plan-schedule"
import { billingStripe } from "@/lib/billing/provider"

export const runtime = "nodejs"
export const maxDuration = 60
export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET))
    return billingJson({ error: "unauthorized" }, 401)
  if (!billingConfig().configured) return billingJson({ configured: false })
  try {
    const stripe = billingStripe({ timeout: 2000, maxNetworkRetries: 0 })
    const result = await runBillingWorker(authDbPool, stripe)
    let finishedChanges = 0
    try {
      finishedChanges = await finishPlanChanges(authDbPool, stripe)
    } catch {
      result.failed++
      console.error("[billing] scheduled change reconciliation failed")
    }

    return billingJson(
      { ...result, finishedChanges },
      result.failed ? 503 : 200
    )
  } catch (error) {
    return billingFailure(error)
  }
}
