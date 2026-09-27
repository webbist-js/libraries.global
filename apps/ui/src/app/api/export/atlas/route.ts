import { headers } from "next/headers"
import { z } from "zod"

import {
  type AtlasLibrary,
  fromFeatureCollection,
} from "@/components/atlas/atlas.logic"
import { requireEntitlement } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { getEnvVar } from "@/lib/env-vars"
import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRow,
  EXPORT_ATTRIBUTION,
  MAX_EXPORT_IDS,
  toCsv,
  toGeoJson,
} from "@/lib/export-format"
import { routing } from "@/lib/navigation"
import { absoluteUrl } from "@/lib/seo/metadata"
import { createStrapiAuthHeader } from "@/lib/strapi-api/request-auth"

// 10,000 ids of 64 characters, as JSON, fit comfortably.
const MAX_BODY_BYTES = 1024 * 1024

const ExportBody = z.object({
  format: z.enum(["csv", "geojson"]),
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_EXPORT_IDS),
})

const FILE_TYPES = {
  csv: "text/csv; charset=utf-8",
  geojson: "application/geo+json",
} as const

/** A library page's absolute URL, from the path the Atlas links to. */
const pageUrl = (path: string) => absoluteUrl(path, routing.defaultLocale)

/** The plan's export row cap. Missing or malformed limits mean 0. */
function exportRowCap(user: { limits?: unknown }): number {
  const cap = (user.limits as { exportRows?: unknown } | null | undefined)
    ?.exportRows

  return typeof cap === "number" && Number.isFinite(cap) ? cap : 0
}

/**
 * Every published library, as the Atlas loads it, through the same read key
 * the public proxy adds. Cached for five minutes. Null when Strapi fails.
 */
async function loadAtlas(): Promise<AtlasLibrary[] | null> {
  try {
    const strapiUrl = getEnvVar("STRAPI_URL", true)!.replace(/\/$/, "")
    const res = await fetch(`${strapiUrl}/api/libraries/atlas`, {
      headers: {
        accept: "application/json",
        ...(await createStrapiAuthHeader({
          isReadOnly: true,
          isPrivate: false,
        })),
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null

    return fromFeatureCollection(await res.json())
  } catch {
    return null
  }
}

/**
 * POST /api/export/atlas: the libraries in view as CSV or GeoJSON, for Pro.
 * Only ids come from the client; every value is read from our own dataset.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireEntitlement(session?.user, "atlas.export")
  if (denied) return denied

  const raw = await readJsonCapped(req, MAX_BODY_BYTES)
  if (!raw.ok)
    return Response.json(
      {
        error:
          raw.status === 413
            ? "Request body too large"
            : "Invalid request body",
      },
      { status: raw.status }
    )
  const parsed = ExportBody.safeParse(raw.body)
  if (!parsed.success)
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  const { format, ids } = parsed.data

  const cap = exportRowCap(session!.user)
  if (ids.length > cap)
    return Response.json(
      { error: "Too many libraries for one export", limit: cap },
      { status: 413 }
    )

  const libraries = await loadAtlas()
  if (!libraries)
    return Response.json(
      { error: "Library data is unavailable. Try again shortly." },
      { status: 502 }
    )

  const byId = new Map(libraries.map((l) => [l.id, l]))
  const rows = [...new Set(ids)].flatMap((id) => {
    const lib = byId.get(id)

    return lib ? [atlasExportRow(lib, pageUrl)] : []
  })

  const body =
    format === "csv"
      ? toCsv(rows, ATLAS_EXPORT_COLUMNS)
      : JSON.stringify(toGeoJson(rows))
  const date = new Date().toISOString().slice(0, 10)

  return new Response(body, {
    headers: {
      "Content-Type": FILE_TYPES[format],
      "Content-Disposition": `attachment; filename="libraries-global-atlas-${date}.${format}"`,
      "X-Data-Attribution": EXPORT_ATTRIBUTION,
      "Cache-Control": "no-store",
    },
  })
}
