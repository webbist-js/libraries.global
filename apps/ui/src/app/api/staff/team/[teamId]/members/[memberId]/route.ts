import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

type Ctx = { params: Promise<{ teamId: string; memberId: string }> }

// PUT /api/staff/team/[teamId]/members/[memberId]  { teamRole?, assignments? }
export async function PUT(req: Request, { params }: Ctx) {
  const { teamId, memberId } = await params
  if (!isDocumentIdParam(teamId) || !isDocumentIdParam(memberId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/members/${memberId}`,
    libraryDocumentId: null,
    action: null,
    method: "PUT",
    limiter: "write",
    bodyKeys: ["teamRole", "assignments"],
  })
}

// DELETE /api/staff/team/[teamId]/members/[memberId]: remove from the Team.
export async function DELETE(req: Request, { params }: Ctx) {
  const { teamId, memberId } = await params
  if (!isDocumentIdParam(teamId) || !isDocumentIdParam(memberId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/members/${memberId}`,
    libraryDocumentId: null,
    action: null,
    method: "DELETE",
    limiter: "write",
    bodyKeys: [],
  })
}
