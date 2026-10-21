import { proxyStaff } from "@/lib/staff-proxy"

export async function GET(req: Request) {
  return proxyStaff(req, {
    base: "access",
    path: "team-libraries",
    libraryDocumentId: null,
    action: null,
    method: "GET",
    limiter: "read",
    bodyKeys: [],
    params: { q: (value) => value.length >= 2 && value.length <= 120 },
  })
}
