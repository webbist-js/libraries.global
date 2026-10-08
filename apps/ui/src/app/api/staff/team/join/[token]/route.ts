import { proxyStaff } from "@/lib/staff-proxy"

// GET /api/staff/team/join/[token]: what the invite is, before accepting.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/join/${token}`,
    libraryDocumentId: null,
    action: null,
    method: "GET",
    limiter: "read",
    bodyKeys: [],
  })
}
