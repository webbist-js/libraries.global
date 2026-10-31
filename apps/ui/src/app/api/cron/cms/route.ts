import { isCronRequest } from "@/lib/auth-retention"
import { cmsMaintenance } from "@/lib/cms-maintenance"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  if (
    !isCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const result = await cmsMaintenance("maintenance")

  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  })
}
