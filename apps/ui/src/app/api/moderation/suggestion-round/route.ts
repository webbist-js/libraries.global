import { proxyModeration } from "@/lib/moderation-proxy"

export async function GET(req: Request) {
  return proxyModeration(req, { path: "suggestion-round" })
}
export async function PUT(req: Request) {
  return proxyModeration(req, {
    path: "suggestion-round",
    method: "PUT",
    bodyKeys: ["action", "version", "cutoffAt", "reviewAt", "capacity"],
  })
}
