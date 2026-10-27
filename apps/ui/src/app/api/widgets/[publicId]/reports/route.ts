import { readJsonCapped } from "@/lib/bridge-params"
import { createRateLimiter } from "@/lib/rate-limit"
import { fetchPublicWidget } from "@/lib/widgets/public-server"

const limiter = createRateLimiter({
  name: "widget-csp-reports",
  max: 20,
  windowMs: 60000,
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params
  if (!/^[A-Za-z0-9_-]{24}$/.test(publicId))
    return new Response(null, { status: 404 })
  const limit = await limiter.check(publicId)
  if (!limit.ok) return new Response(null, { status: 429 })
  const parsed = await readJsonCapped(req, 8000)
  if (!parsed.ok) return new Response(null, { status: 400 })
  const report = (parsed.body as Record<string, unknown>)?.["csp-report"] as
    | Record<string, unknown>
    | undefined
  if (report?.["effective-directive"] === "frame-ancestors")
    await fetchPublicWidget(publicId, "reports")

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  })
}
