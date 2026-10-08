import { NOTICE_BODY_KEYS } from "@/lib/staff/notice-body"
import { proxyStaff } from "@/lib/staff-proxy"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/notices`,
    libraryDocumentId: documentId,
    action: "notices",
    limiter: "read",
  })
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/notices`,
    libraryDocumentId: documentId,
    action: "notices",
    method: "POST",
    bodyKeys: NOTICE_BODY_KEYS,
    limiter: "notice",
  })
}
