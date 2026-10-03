import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// GET /api/moderation/submissions/[documentId]
export async function GET(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}`,
    ids: [documentId],
  })
}
