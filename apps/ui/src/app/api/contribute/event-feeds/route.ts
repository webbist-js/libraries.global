import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  return proxyEventFeed(req, { method: "GET", path: "feeds", kind: "read" })
}

export function POST(req: Request) {
  return proxyEventFeed(req, {
    method: "POST",
    path: "feeds",
    kind: "write",
    libraryFromBody: true,
    validateValues: "body",
  })
}
