import { localDateTime } from "@repo/shared-data"

import { isDocumentIdParam } from "@/lib/bridge-params"
import { mobileCalendar } from "@/lib/mobile/calendar"
import { fetchMobileTimetable } from "@/lib/mobile/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params,
    stop = new URL(request.url).searchParams.get("stop")
  if (!isDocumentIdParam(documentId) || !stop || !/^[a-z0-9]{10}$/.test(stop))
    return Response.json(
      { error: "Choose a library and stop" },
      { status: 400 }
    )
  try {
    const data = await fetchMobileTimetable(documentId)
    if (!data?.timetable?.stops.some((row) => row.id === stop))
      return Response.json({ error: "Not found" }, { status: 404 })
    const calendar = mobileCalendar({
      id: documentId,
      name: data.name,
      timetable: data.timetable,
      notices: data.notices,
      stopId: stop,
      timezone: data.timezone,
      from: localDateTime(new Date(), data.timezone).date,
      updatedAt: data.updatedAt,
      url: data.path
        ? new URL(
            data.path,
            process.env.APP_PUBLIC_URL ?? request.url
          ).toString()
        : undefined,
    })

    return new Response(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="mobile-library-${stop}.ics"`,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
      },
    })
  } catch {
    return Response.json({ error: "Calendar unavailable" }, { status: 503 })
  }
}
