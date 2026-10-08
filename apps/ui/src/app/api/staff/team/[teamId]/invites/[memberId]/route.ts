import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

// DELETE /api/staff/team/[teamId]/invites/[memberId]: revoke an invite.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const { teamId, memberId } = await params
  if (!isDocumentIdParam(teamId) || !isDocumentIdParam(memberId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/invites/${memberId}`,
    libraryDocumentId: null,
    action: null,
    method: "DELETE",
    limiter: "write",
    bodyKeys: [],
  })
}
