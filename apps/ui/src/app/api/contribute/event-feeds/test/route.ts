import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export function POST(req: Request) {
  return proxyEventFeed(req, {
    method: "POST",
    path: "feeds/test",
    kind: "test",
    libraryFromBody: true,
    validateValues: "body",
  })
}
