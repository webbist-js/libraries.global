import { authDbPool } from "@/lib/auth"
import { isCronRequest } from "@/lib/auth-retention"
import { billingConfig } from "@/lib/billing/config"
import { runBillingWorker } from "@/lib/billing/events"
import { billingFailure, billingJson } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { maintainApiJobs } from "@/lib/team-api/analysis-jobs"
import { maintainApiUsage } from "@/lib/team-api/store"

export const runtime = "nodejs"
export const maxDuration = 60
export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET))
    return billingJson({ error: "unauthorized" }, 401)
  try {
    // Expired analysis jobs refund their credits exactly once, before the
    // ledger's one-hour sweep of abandoned reservations.
    try {
      await maintainApiJobs(authDbPool)
    } catch {
      console.error("[api] analysis job maintenance failed")
    }
    // Abandoned quota reservations are refunded even while provider
    // credentials are unavailable. Deploy billing:migrate with this release.
    if (!billingConfig().configured) {
      await maintainApiUsage(authDbPool)

      return billingJson({ configured: false })
    }
    const stripe = billingStripe({ timeout: 2000, maxNetworkRetries: 0 })
    const result = await runBillingWorker(authDbPool, stripe)

    return billingJson(result, result.failed ? 503 : 200)
  } catch (error) {
    return billingFailure(error)
  }
}
