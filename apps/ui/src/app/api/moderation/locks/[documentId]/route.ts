import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// POST /api/moderation/locks/[documentId] { action: acquire | release | takeover }
// The caller's Review Lock on a pending submission (ADR-0008).
export async function POST(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `locks/${encodeURIComponent(documentId)}`,
    ids: [documentId],
    method: "POST",
    bodyKeys: ["action"],
  })
}
