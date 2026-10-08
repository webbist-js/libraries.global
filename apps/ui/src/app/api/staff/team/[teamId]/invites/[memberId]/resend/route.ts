import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

// POST /api/staff/team/[teamId]/invites/[memberId]/resend: a fresh link.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const { teamId, memberId } = await params
  if (!isDocumentIdParam(teamId) || !isDocumentIdParam(memberId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/invites/${memberId}/resend`,
    libraryDocumentId: null,
    action: null,
    method: "POST",
    limiter: "invite",
    bodyKeys: [],
  })
}
