import { authDbPool } from "@/lib/auth"
import { apiLibraries, serveTeamApi } from "@/lib/team-api/gateway"

export const runtime = "nodejs"
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entityRef: string }> }
) {
  const { entityRef } = await params

  return serveTeamApi(
    authDbPool,
    request,
    "libraries:read",
    "libraries.detail",
    (maximum) => apiLibraries(request, maximum, entityRef)
  )
}
