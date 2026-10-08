import { proxyLive } from "@/lib/mobile-live/proxy"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await ctx.params

  return proxyLive(req, {
    path: `libraries/${documentId}/live-sessions`,
    id: documentId,
    action: "seeTeam",
    method: "GET",
    keys: ["locale"],
    max: 60,
    windowMs: 60000,
  })
}
