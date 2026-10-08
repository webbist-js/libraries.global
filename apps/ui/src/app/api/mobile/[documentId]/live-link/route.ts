import { proxyLive } from "@/lib/mobile-live/proxy"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await ctx.params

  return proxyLive(req, {
    path: `libraries/${documentId}/live-link`,
    id: documentId,
    action: "seeTeam",
    method: "POST",
    keys: ["locale"],
    max: 5,
    windowMs: 86400000,
  })
}
