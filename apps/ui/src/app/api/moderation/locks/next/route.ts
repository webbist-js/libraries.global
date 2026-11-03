import { proxyModeration, SUBMISSION_LIST_PARAMS } from "@/lib/moderation-proxy"

// POST /api/moderation/locks/next?<queue filters>
// Locks and names the next submission nobody else is reviewing (ADR-0008).
export async function POST(req: Request) {
  return proxyModeration(req, {
    path: "locks/next",
    method: "POST",
    params: SUBMISSION_LIST_PARAMS,
    bodyKeys: [],
  })
}
