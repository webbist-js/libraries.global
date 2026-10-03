import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// GET /api/moderation/submissions/[documentId]/events — Review Events, oldest first
export async function GET(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/events`,
    ids: [documentId],
  })
}
