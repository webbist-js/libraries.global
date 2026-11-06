import { BillingError } from "@/lib/billing/config"
import { jobResult, ownedJob, refreshJob } from "@/lib/team-api/analysis-jobs"
import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute, strictQuery } from "@/lib/team-api/resources"

export const runtime = "nodejs"

/** Delivery spends one request and its bytes, never a second credit. */
export const GET = flaggedRoute(
  "analysis",
  withApiRequest<{ params: Promise<{ id: string }> }>(
    { scope: "analysis:run", endpoint: "analysis.result" },
    async ({ request, account }, { params }) => {
      strictQuery(request, [])
      const { authDbPool } = await import("@/lib/auth")
      const job = await ownedJob(authDbPool, account.teamId, (await params).id)
      if (!job) throw new BillingError("record_not_found", 404)

      return jobResult(await refreshJob(authDbPool, job))
    }
  )
)
