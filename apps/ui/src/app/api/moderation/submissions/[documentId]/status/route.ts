import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// PUT /api/moderation/submissions/[documentId]/status  { status, note?, publish? }
export async function PUT(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/status`,
    ids: [documentId],
    method: "PUT",
    bodyKeys: ["status", "note", "publish"],
  })
}
