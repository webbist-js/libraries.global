import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string; noticeId: string }> }
) {
  const { documentId, noticeId } = await params
  if (!isDocumentIdParam(noticeId))
    return Response.json({ error: "Invalid id" }, { status: 400 })

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/notices/${noticeId}/end`,
    libraryDocumentId: documentId,
    action: "notices",
    method: "POST",
    bodyKeys: [],
    limiter: "notice",
  })
}
