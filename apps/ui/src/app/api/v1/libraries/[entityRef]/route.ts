import { apiLibraries, withApiRequest } from "@/lib/team-api/gateway"

export const runtime = "nodejs"

export const GET = withApiRequest<{ params: Promise<{ entityRef: string }> }>(
  { scope: "libraries:read", endpoint: "libraries.detail" },
  async ({ request, maximum }, { params }) =>
    apiLibraries(request, maximum, (await params).entityRef)
)
