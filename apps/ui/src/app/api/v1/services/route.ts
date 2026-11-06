import { withApiRequest } from "@/lib/team-api/gateway"
import { flaggedRoute } from "@/lib/team-api/resources"
import { apiServices } from "@/lib/team-api/services"

export const runtime = "nodejs"

export const GET = flaggedRoute(
  "services",
  withApiRequest(
    { scope: "services:read", endpoint: "services.list" },
    ({ request, maximum }) => apiServices(request, maximum)
  )
)
