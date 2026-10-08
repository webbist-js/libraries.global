import { proxyStaff } from "@/lib/staff-proxy"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "content-moderation/staff",
    path: `libraries/${documentId}/verify`,
    libraryDocumentId: documentId,
    action: "edit",
    method: "POST",
    bodyKeys: ["sections"],
    limiter: "publish",
  })
}
