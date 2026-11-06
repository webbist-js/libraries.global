import { apiResult, withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"
import { apiSubmitProposal } from "@/lib/team-api/submissions"

export const runtime = "nodejs"

export const POST = flaggedRoute(
  "submissions",
  withApiRequest(
    { scope: "submissions:write", endpoint: "submissions.libraries" },
    async ({ request, maximum, account }) => {
      const { status, body } = await apiSubmitProposal(
        request,
        "library",
        account,
        maximum
      )

      return apiResult(body, { status })
    }
  )
)
