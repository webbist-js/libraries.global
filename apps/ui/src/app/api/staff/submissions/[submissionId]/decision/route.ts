import { revalidateTag } from "next/cache"

import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params
  if (!isDocumentIdParam(submissionId))
    return Response.json({ error: "Invalid id" }, { status: 400 })
  const response = await proxyStaff(req, {
    base: "content-moderation/staff",
    path: `submissions/${submissionId}/decision`,
    libraryDocumentId: null,
    action: null,
    method: "POST",
    bodyKeys: ["action", "reason", "note"],
    limiter: "publish",
  })
  if (response.ok) revalidateTag("library", { expire: 0 })

  return response
}
