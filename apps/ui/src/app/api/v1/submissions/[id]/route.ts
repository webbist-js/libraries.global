import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"
import { apiProposalStatus } from "@/lib/team-api/submissions"

export const runtime = "nodejs"

export const GET = flaggedRoute(
  "submissions",
  withApiRequest<{ params: Promise<{ id: string }> }>(
    { scope: "submissions:write", endpoint: "submissions.status" },
    async ({ request, maximum, account }, { params }) =>
      apiProposalStatus(request, (await params).id, account.teamId, maximum)
  )
)
