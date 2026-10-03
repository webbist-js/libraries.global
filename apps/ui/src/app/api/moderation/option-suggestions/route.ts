import { proxyModeration } from "@/lib/moderation-proxy"

// GET /api/moderation/option-suggestions — editorial board (Strapi enforces it)
export function GET(req: Request) {
  return proxyModeration(req, { path: "option-suggestions" })
}
