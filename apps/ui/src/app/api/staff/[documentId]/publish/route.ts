import { proxyStaff } from "@/lib/staff-proxy"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "content-moderation/staff",
    path: `libraries/${documentId}/publish`,
    libraryDocumentId: documentId,
    action: "edit",
    method: "POST",
    bodyKeys: ["fields", "previous", "draftDocumentId", "locale", "note"],
    limiter: "publish",
  })
}
