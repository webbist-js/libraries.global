import {
  proxyModeration,
  SUBMISSION_STATS_PARAMS,
} from "@/lib/moderation-proxy"

// GET /api/moderation/stats — counts per queue and status, within scope
export function GET(req: Request) {
  return proxyModeration(req, {
    path: "stats",
    params: SUBMISSION_STATS_PARAMS,
  })
}
