import { parseAtlasReachResult } from "@repo/shared-data"

import { requireEntitlement } from "@/lib/access-server"
import { auth } from "@/lib/auth"

import { POST as reach } from "../route"

export const runtime = "nodejs"
export const maxDuration = 30
const csv = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^\s*[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`

export async function POST(req: Request) {
  const user = (await auth.api.getSession({ headers: req.headers }))?.user
  const denied =
    requireEntitlement(user, "atlas.export") ||
    requireEntitlement(user, "atlas.analysis")
  if (denied) return denied
  const format = new URL(req.url).searchParams.get("format")
  if (format !== "csv" && format !== "geojson")
    return Response.json({ error: "Expected csv or geojson" }, { status: 400 })
  const response = await reach(req)
  if (!response.ok || response.status === 202) return response
  const value = await response.json()
  if (!["ready", "partial"].includes(value.state))
    return Response.json(
      { error: "A calculated result is required" },
      { status: 409 }
    )
  const result = parseAtlasReachResult(value)
  const metadata = {
    libraryId: result.libraryId,
    coordinateHash: result.coordinateHash,
    state: result.state,
    mode: result.mode,
    calculatedAt: result.calculatedAt,
    method: result.method,
    networkRelease: result.network.release,
    networkSource: result.network.sourceUrl,
    networkLicence: result.network.licence,
    populationRelease: result.population.release,
    populationYear: result.population.year,
    populationSource: result.population.sourceUrl,
    populationLicence: result.population.licence,
    snapDistanceMetres: result.snapDistanceMetres,
    assumptions: result.warnings.join(" "),
  }
  const rows = result.contours.map(({ geometry: _geometry, ...contour }) => ({
    ...metadata,
    ...contour,
  }))
  const columns = Object.keys(rows[0]!)
  const body =
    format === "csv"
      ? [
          columns.map(csv).join(","),
          ...rows.map((row) =>
            columns
              .map((column) => csv(row[column as keyof typeof row]))
              .join(",")
          ),
        ].join("\r\n")
      : JSON.stringify({
          type: "FeatureCollection",
          features: result.contours.map(({ geometry, ...contour }) => ({
            type: "Feature",
            geometry,
            properties: { ...metadata, ...contour },
          })),
        })

  return new Response(body, {
    headers: {
      "content-type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/geo+json",
      "content-disposition": `attachment; filename="reach-${result.libraryId}-${result.mode}.${format}"`,
      "cache-control": "no-store",
    },
  })
}
