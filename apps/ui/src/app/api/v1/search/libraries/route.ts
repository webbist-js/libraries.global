import { authDbPool } from "@/lib/auth"
import { apiSearch, serveTeamApi } from "@/lib/team-api/gateway"

export const runtime = "nodejs"
export async function POST(request: Request) {
  return serveTeamApi(
    authDbPool,
    request,
    "search:read",
    "search.libraries",
    (maximum) => apiSearch(request, maximum)
  )
}
