import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

// GET /api/staff/team/[teamId]: one Team as the viewer may see it. Strapi
// re-reads their membership (organiser: everything; member: read only).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  if (!isDocumentIdParam(teamId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}`,
    libraryDocumentId: null,
    action: null,
    method: "GET",
    limiter: "read",
    bodyKeys: [],
  })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  if (!isDocumentIdParam(teamId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}`,
    libraryDocumentId: null,
    action: null,
    method: "PUT",
    limiter: "write",
    bodyKeys: ["name", "libraryDocumentIds", "primaryNetworkId"],
  })
}
