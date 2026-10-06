import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  return proxyEventFeed(req, {
    method: "GET",
    path: "feeds/providers",
    kind: "read",
  })
}
