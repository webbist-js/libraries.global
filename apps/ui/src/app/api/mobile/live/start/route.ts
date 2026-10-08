import { proxyLive } from "@/lib/mobile-live/proxy"

export function POST(req: Request) {
  return proxyLive(req, {
    path: "live/start",
    method: "POST",
    proof: true,
    keys: ["libraryDocumentId", "mode", "routeDate"],
    max: 5,
    windowMs: 3_600_000,
  })
}
