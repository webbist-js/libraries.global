import { proxyModeration } from "@/lib/moderation-proxy"

// GET /api/moderation/stats — counts per queue and status, within scope
export function GET(req: Request) {
  return proxyModeration(req, { path: "stats" })
}
