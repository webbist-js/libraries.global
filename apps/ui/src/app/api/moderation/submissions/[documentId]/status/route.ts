import { revalidateTag } from "next/cache"

import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// PUT /api/moderation/submissions/[documentId]/status  { status, note?, publish? }
// A decision revalidates the drive tag (spec §5.3): a just-approved Drive
// Proposal's scheduled drive, or any drive-tagged change's progress, shows
// at once.
export async function PUT(req: Request, { params }: Ctx) {
  const { documentId } = await params
  const res = await proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/status`,
    ids: [documentId],
    method: "PUT",
    bodyKeys: ["status", "note", "publish"],
  })
  if (res.ok) revalidateTag("drive", { expire: 0 })

  return res
}
