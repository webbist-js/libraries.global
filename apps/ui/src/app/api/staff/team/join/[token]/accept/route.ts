import { proxyStaff } from "@/lib/staff-proxy"

// POST /api/staff/team/join/[token]/accept: join the Team (the signed-in
// email must match the invited one; Strapi checks).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token))
    return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/join/${token}/accept`,
    libraryDocumentId: null,
    action: null,
    method: "POST",
    limiter: "write",
    bodyKeys: [],
  })
}
