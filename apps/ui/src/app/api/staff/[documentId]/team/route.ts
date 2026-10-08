import { proxyStaff } from "@/lib/staff-proxy"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/team`,
    libraryDocumentId: documentId,
    action: "seeTeam",
    method: "GET",
    limiter: "read",
    bodyKeys: [],
  })
}
