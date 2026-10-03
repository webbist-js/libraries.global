import { proxyModeration, RELATION_LABEL_PARAMS } from "@/lib/moderation-proxy"

// GET /api/moderation/relation-labels?type=services|amenities|accessibility
export function GET(req: Request) {
  return proxyModeration(req, {
    path: "relation-labels",
    params: RELATION_LABEL_PARAMS,
  })
}
