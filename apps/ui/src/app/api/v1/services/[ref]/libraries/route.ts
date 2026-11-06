import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"
import { apiService } from "@/lib/team-api/services"

export const runtime = "nodejs"

export const GET = flaggedRoute(
  "services",
  withApiRequest<{ params: Promise<{ ref: string }> }>(
    { scope: "services:read", endpoint: "services.libraries" },
    async ({ request, maximum }, { params }) =>
      apiService(request, maximum, (await params).ref, true)
  )
)
