import { isDocumentIdParam } from "@/lib/bridge-params"
import { errorResponse, proxyLive } from "@/lib/mobile-live/proxy"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params
  if (!isDocumentIdParam(sessionId)) return errorResponse("invalid_id", 400)

  return proxyLive(req, {
    path: `live/${sessionId}/events`,
    method: "POST",
    proof: true,
    keys: ["events"],
    max: 20,
    windowMs: 60_000,
  })
}
