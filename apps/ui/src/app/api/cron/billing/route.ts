import { authDbPool } from "@/lib/auth"
import { isCronRequest } from "@/lib/auth-retention"
import { billingConfig } from "@/lib/billing/config"
import { runBillingWorker } from "@/lib/billing/events"
import { billingFailure, billingJson } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"

export const runtime = "nodejs"
export const maxDuration = 60
export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET))
    return billingJson({ error: "unauthorized" }, 401)
  if (!billingConfig().configured) return billingJson({ configured: false })
  try {
    const result = await runBillingWorker(
      authDbPool,
      billingStripe({ timeout: 2000, maxNetworkRetries: 0 })
    )

    return billingJson(result, result.failed ? 503 : 200)
  } catch (error) {
    return billingFailure(error)
  }
}
