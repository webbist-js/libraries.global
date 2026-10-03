import { proxyModeration } from "@/lib/moderation-proxy"

type Ctx = { params: Promise<{ id: string }> }

// PUT /api/moderation/option-suggestions/[id]  { decision, name?, note? }
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params

  return proxyModeration(req, {
    path: `option-suggestions/${encodeURIComponent(id)}`,
    ids: [id],
    method: "PUT",
    bodyKeys: ["decision", "name", "note"],
  })
}
