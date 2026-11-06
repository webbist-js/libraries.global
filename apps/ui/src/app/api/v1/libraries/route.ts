import { apiLibraries, withApiRequest } from "@/lib/team-api/gateway"

export const runtime = "nodejs"

export const GET = withApiRequest(
  { scope: "libraries:read", endpoint: "libraries.list" },
  ({ request, maximum }) => apiLibraries(request, maximum)
)
