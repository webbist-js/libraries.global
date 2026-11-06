import { jobResult, jobView, runSummary } from "@/lib/team-api/analysis-jobs"
import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"

export const runtime = "nodejs"

/** Credits are reserved per operation inside the handler (see analysis-jobs). */
export const POST = flaggedRoute(
  "analysis",
  withApiRequest(
    { scope: "analysis:run", endpoint: "analysis.summary" },
    async ({ request, account }) => {
      const { authDbPool } = await import("@/lib/auth")
      const job = await runSummary(authDbPool, request, account)

      return { ...jobResult(job), job: jobView(job) }
    }
  )
)
