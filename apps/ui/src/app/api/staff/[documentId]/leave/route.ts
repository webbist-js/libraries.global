import { proxyStaff } from "@/lib/staff-proxy"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/leave`,
    libraryDocumentId: documentId,
    action: "seeTeam",
    method: "POST",
    limiter: "write",
    bodyKeys: [],
  })
}
