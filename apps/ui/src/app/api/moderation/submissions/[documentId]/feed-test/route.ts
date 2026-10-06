import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// PUT /api/moderation/submissions/[documentId]/feed-test — re-run the
// connection test on the value under review.
export async function PUT(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/feed-test`,
    ids: [documentId],
    method: "PUT",
    bodyKeys: [],
  })
}
