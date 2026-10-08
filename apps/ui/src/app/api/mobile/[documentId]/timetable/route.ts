import { isDocumentIdParam } from "@/lib/bridge-params"
import { fetchMobileTimetable } from "@/lib/mobile/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  if (!isDocumentIdParam(documentId))
    return Response.json({ error: "Invalid documentId" }, { status: 400 })
  try {
    const data = await fetchMobileTimetable(documentId)

    return data
      ? Response.json(data, {
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        })
      : Response.json({ error: "Not found" }, { status: 404 })
  } catch {
    return Response.json({ error: "Timetable unavailable" }, { status: 503 })
  }
}
