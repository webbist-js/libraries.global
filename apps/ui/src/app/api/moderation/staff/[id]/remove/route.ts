import { revalidateTag } from "next/cache"

import { proxyModeration } from "@/lib/moderation-proxy"

// POST /api/moderation/staff/[id]/remove  (id = the affiliation)
// A Moderator with an `index` (or every-queue) scope removes a library's
// staff member; Strapi re-checks the scope, deletes the affiliation through
// its lifecycle (live sessions end, the person is emailed, the audit is
// written) and answers 404 for a missing row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const affiliationId = (await params).id
  const res = await proxyModeration(req, {
    path: `staff/${encodeURIComponent(affiliationId)}/remove`,
    ids: [affiliationId],
    method: "POST",
    bodyKeys: [],
  })
  if (res.ok) revalidateTag("library", { expire: 0 })

  return res
}
