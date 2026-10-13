import { authDbPool } from "@/lib/auth"
import { apiLibraries, serveTeamApi } from "@/lib/team-api/gateway"

export const runtime = "nodejs"
export async function GET(request: Request) {
  return serveTeamApi(
    authDbPool,
    request,
    "libraries:read",
    "libraries.list",
    (maximum) => apiLibraries(request, maximum)
  )
}
