import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

// POST /api/staff/team/[teamId]/invites  { email, teamRole?, preassign? }
// Organisers only (checked in Strapi).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  if (!isDocumentIdParam(teamId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/invites`,
    libraryDocumentId: null,
    action: null,
    method: "POST",
    limiter: "invite",
    bodyKeys: ["email", "teamRole", "preassign"],
  })
}
