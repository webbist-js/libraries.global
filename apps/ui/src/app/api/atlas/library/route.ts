import { projectAtlasLibrary } from "@repo/shared-data"

import { atlasProjectionLibrary } from "@/components/atlas/atlas-data-adapter"
import { createAtlasBackend } from "@/lib/atlas-backend"

export async function GET(req: Request) {
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json({ error: "Atlas unavailable" }, { status: 503 })
  const params = new URL(req.url).searchParams,
    key = params.get("key"),
    locale = params.get("locale")
  if (
    !key ||
    !/^[\p{L}\p{N}_-]{1,255}$/u.test(key) ||
    (locale !== null && !/^[a-zA-Z-]{2,20}$/.test(locale)) ||
    [...params.keys()].some((field) => !["key", "locale"].includes(field))
  )
    return Response.json(
      { error: "Invalid library selection" },
      { status: 400 }
    )
  try {
    const backend = createAtlasBackend(req.signal),
      state = await backend.state()
    const body = await backend.bridge(
      `/api/atlas/library?${new URLSearchParams({ key, ...(locale ? { locale } : {}) })}`
    )
    const options = {
      atlasId: 1,
      canonicalLocale: state.canonicalLocale,
      now: new Date(),
    }
    const mapped = projectAtlasLibrary(body.source, options)
    // Published selection does not depend on plotted geometry. A summary can
    // exist without a point; its placeholder coordinate is never drawn/shown.
    const row =
      mapped ??
      projectAtlasLibrary(
        { ...body.source, location: { lat: 0, lng: 0 }, mobileTimetable: null },
        options
      )
    if (!row)
      return Response.json({ error: "Library not found" }, { status: 404 })
    const library = atlasProjectionLibrary(row)
    library.mapped = mapped !== null
    library.notices = body.source.notices ?? []
    library.closedDates = row.closed_dates
    library.access = (body.source.accessibility ?? []).map(
      (e: { name: string }) => e.name
    )
    library.services = [
      ...(body.source.services ?? []),
      ...(body.source.amenities ?? []),
    ].map((e: { name: string }) => e.name)

    return Response.json(
      { library },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (error) {
    return Response.json(
      { error: "Library unavailable" },
      {
        status:
          error instanceof Error && error.message === "Atlas backend HTTP 404"
            ? 404
            : 503,
      }
    )
  }
}
