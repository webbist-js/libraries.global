import { apiSearch, withApiRequest } from "@/lib/team-api/gateway"

export const runtime = "nodejs"

export const POST = withApiRequest(
  { scope: "search:read", endpoint: "search.libraries" },
  ({ request, maximum }) => apiSearch(request, maximum)
)
