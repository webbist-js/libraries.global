import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ documentId: string }> }

// PUT /api/moderation/submissions/[documentId]/drive-dates { startsAt, endsAt }
// The dates a Drive Proposal's drive is created with on approval.
export async function PUT(req: Request, { params }: Ctx) {
  const { documentId } = await params

  return proxyModeration(req, {
    path: `submissions/${encodeURIComponent(documentId)}/drive-dates`,
    ids: [documentId],
    method: "PUT",
    bodyKeys: ["startsAt", "endsAt"],
  })
}
