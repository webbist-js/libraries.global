import { isDocumentIdParam } from "@/lib/bridge-params"
import { errorResponse, proxyLive } from "@/lib/mobile-live/proxy"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params
  if (!isDocumentIdParam(sessionId)) return errorResponse("invalid_id", 400)

  return proxyLive(req, {
    path: `live/${sessionId}/end`,
    method: "POST",
    proof: false,
    keys: [],
    max: 30,
    windowMs: 60_000,
  })
}
