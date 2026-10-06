import { proxyModeration } from "@/lib/moderation-proxy"

// GET /api/moderation/drive-stats — pending tagged submissions per open drive
export function GET(req: Request) {
  return proxyModeration(req, { path: "drive-stats" })
}
