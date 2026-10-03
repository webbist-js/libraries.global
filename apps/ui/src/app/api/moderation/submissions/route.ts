import { proxyModeration, SUBMISSION_LIST_PARAMS } from "@/lib/moderation-proxy"

// GET /api/moderation/submissions?status&queue&type&locale&q&page&pageSize
export function GET(req: Request) {
  return proxyModeration(req, {
    path: "submissions",
    params: SUBMISSION_LIST_PARAMS,
  })
}
