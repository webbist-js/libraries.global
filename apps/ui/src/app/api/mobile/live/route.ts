import { isDocumentIdParam } from "@/lib/bridge-params"
import { errorResponse } from "@/lib/mobile-live/proxy"

export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",") ?? []
  if (
    !ids.length ||
    ids.length > 50 ||
    ids.some((id) => !isDocumentIdParam(id))
  )
    return errorResponse("invalid_ids", 400)
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return errorResponse("bridge_unavailable", 503)
  try {
    const r = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/mobile-libraries/live?ids=${encodeURIComponent([...new Set(ids)].join(","))}`,
      {
        headers: { "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    )

    return Response.json(await r.json(), {
      status: r.status,
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15",
        "Referrer-Policy": "no-referrer",
      },
    })
  } catch {
    return errorResponse("live_service_unavailable", 502)
  }
}
