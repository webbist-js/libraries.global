import { proxyStaff } from "@/lib/staff-proxy"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "content-moderation/staff",
    path: `libraries/${documentId}/suggestions`,
    libraryDocumentId: documentId,
    action: "reviewSuggestions",
    params: { page: (v) => /^\d+$/.test(v), pageSize: (v) => /^\d+$/.test(v) },
    limiter: "read",
  })
}
