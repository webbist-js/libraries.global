import { proxyLive } from "@/lib/mobile-live/proxy"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await ctx.params

  return proxyLive(req, {
    path: `libraries/${documentId}/live-settings`,
    id: documentId,
    action: "seeTeam",
    method: "GET",
    keys: ["locale"],
    max: 60,
    windowMs: 60000,
  })
}
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await ctx.params

  return proxyLive(req, {
    path: `libraries/${documentId}/live-settings`,
    id: documentId,
    action: "manageLive",
    method: "PUT",
    keys: ["enabled", "precision", "autoStopMinutes", "privacyAccepted"],
    max: 20,
    windowMs: 3_600_000,
  })
}
