import { acceptReach, jobResult, jobView } from "@/lib/team-api/analysis-jobs"
import { apiResult, withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"

export const runtime = "nodejs"

/** 202 with a job to poll, or 200 with a cached or already finished result. */
export const POST = flaggedRoute(
  "analysis",
  withApiRequest(
    { scope: "analysis:run", endpoint: "analysis.reach" },
    async ({ request, account }) => {
      const { authDbPool } = await import("@/lib/auth")
      const job = await acceptReach(authDbPool, request, account)
      if (job.state !== "complete")
        return apiResult({ job: jobView(job) }, { status: 202 })

      return { ...jobResult(job), job: jobView(job) }
    }
  )
)
