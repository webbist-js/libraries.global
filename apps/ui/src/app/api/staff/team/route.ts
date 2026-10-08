import { proxyStaff } from "@/lib/staff-proxy"

// GET /api/staff/team: the Teams the signed-in user belongs to.
export async function GET(req: Request) {
  return proxyStaff(req, {
    base: "access",
    path: "teams/mine",
    libraryDocumentId: null,
    action: null,
    method: "GET",
    limiter: "read",
    bodyKeys: [],
  })
}
