import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// PUT /api/moderation/submissions/[documentId]/target  { continent?, country?, region?, area? }
export async function PUT(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/target`,
    ids: [documentId],
    method: "PUT",
    bodyKeys: ["continent", "country", "region", "area"],
  })
}
