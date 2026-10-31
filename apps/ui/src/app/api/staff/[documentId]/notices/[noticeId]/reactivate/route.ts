import { isDocumentIdParam } from "@/lib/bridge-params"
import { NOTICE_BODY_KEYS } from "@/lib/staff/notice-body"
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
    path: `libraries/${documentId}/notices/${noticeId}/reactivate`,
    libraryDocumentId: documentId,
    action: "notices",
    method: "POST",
    bodyKeys: NOTICE_BODY_KEYS,
    limiter: "notice",
  })
}
