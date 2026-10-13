import { isCalendarDate, localDateTime } from "@repo/shared-data"

import { isDocumentIdParam } from "@/lib/bridge-params"
import { fetchRoadRoutes } from "@/lib/mobile/road-routes"
import { fetchMobileTimetable } from "@/lib/mobile/server"
import type { MobileVisitFilter } from "@/lib/mobile-stop-search"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  const query = new URL(request.url).searchParams
  const mode = query.get("mode") ?? "any"
  if (
    !isDocumentIdParam(documentId) ||
    !["any", "today", "week", "live"].includes(mode) ||
    (query.has("date") && !isCalendarDate(query.get("date")!))
  )
    return Response.json({ error: "Invalid route request" }, { status: 400 })
  try {
    const library = await fetchMobileTimetable(documentId)
    if (!library) return Response.json({ error: "Not found" }, { status: 404 })
    const date =
      query.get("date") ?? localDateTime(new Date(), library.timezone).date
    const data = await fetchRoadRoutes(library, date, mode as MobileVisitFilter)

    return Response.json(data, {
      headers: {
        "Cache-Control": data.unavailable
          ? "no-store"
          : "public, max-age=300, stale-while-revalidate=3600",
      },
    })
  } catch {
    return Response.json({ routes: [], unavailable: true }, { status: 503 })
  }
}
