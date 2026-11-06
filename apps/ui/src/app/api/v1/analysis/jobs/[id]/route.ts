import { BillingError } from "@/lib/billing/config"
import { jobView, ownedJob, refreshJob } from "@/lib/team-api/analysis-jobs"
import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute, strictQuery } from "@/lib/team-api/resources"

export const runtime = "nodejs"

export const GET = flaggedRoute(
  "analysis",
  withApiRequest<{ params: Promise<{ id: string }> }>(
    { scope: "analysis:run", endpoint: "analysis.job" },
    async ({ request, account }, { params }) => {
      strictQuery(request, [])
      const { authDbPool } = await import("@/lib/auth")
      const job = await ownedJob(authDbPool, account.teamId, (await params).id)
      if (!job) throw new BillingError("record_not_found", 404)

      return { job: jobView(await refreshJob(authDbPool, job)) }
    }
  )
)
