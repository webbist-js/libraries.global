import { headers } from "next/headers"
import { z } from "zod"

import { requireEntitlement } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import {
  DOCUMENT_ID_PATTERN,
  MAX_ID_LENGTH,
  readJsonCapped,
} from "@/lib/bridge-params"
import { getEnvVar } from "@/lib/env-vars"
import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRow,
  EXPORT_ATTRIBUTION,
  type LibraryExportSource,
  MAX_EXPORT_IDS,
  toCsv,
  toGeoJson,
} from "@/lib/export-format"
import { routing } from "@/lib/navigation"
import { absoluteUrl } from "@/lib/seo/metadata"

// Every id at the longest documentId, quoted and comma-separated, plus 1 KB
// for the rest: about 1.75 MB, under Vercel's 4.5 MB request body limit.
const MAX_BODY_BYTES = MAX_EXPORT_IDS * (MAX_ID_LENGTH + 3) + 1024

const ExportBody = z.object({
  format: z.enum(["csv", "geojson"]),
  // Strapi's documentId rule, so a malformed id is a 400 here rather than a
  // failed bridge call. Well-formed ids Strapi doesn't have are skipped.
  ids: z
    .array(z.string().regex(DOCUMENT_ID_PATTERN))
    .min(1)
    .max(MAX_EXPORT_IDS),
})

const FILE_TYPES = {
  csv: "text/csv; charset=utf-8",
  geojson: "application/geo+json",
} as const

const UNAVAILABLE = {
  error: "Library data is unavailable. Try again shortly.",
} as const

/** Makes a `buildLibraryPath` path absolute, on the default locale. */
const pageUrl = (path: string) => absoluteUrl(path, routing.defaultLocale)

/** The plan's export row cap. Missing or malformed limits mean 0. */
function exportRowCap(user: { limits?: unknown }): number {
  const cap = (user.limits as { exportRows?: unknown } | null | undefined)
    ?.exportRows

  return typeof cap === "number" && Number.isFinite(cap) ? cap : 0
}

/**
 * The requested rows from Strapi's bridge-gated export action, keyed by id.
 * Null when Strapi answers with a non-2xx status or the request fails
 * outright; the caller turns that into a 502 without echoing anything back.
 */
async function fetchExportRows(
  ids: readonly string[],
  secret: string
): Promise<Record<string, LibraryExportSource> | null> {
  try {
    const strapiUrl = getEnvVar("STRAPI_URL", true)!.replace(/\/$/, "")
    const res = await fetch(`${strapiUrl}/api/libraries/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: Record<string, LibraryExportSource>
    }

    return json.data ?? {}
  } catch {
    return null
  }
}

/**
 * POST /api/export/atlas: the libraries in view as CSV or GeoJSON, for Pro.
 * Only ids come from the client; every value is read from Strapi's
 * bridge-gated export action, never trusted from the request body.
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

  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return Response.json(
      { error: "Export is not configured." },
      { status: 503 }
    )

  const byId = await fetchExportRows(ids, secret)
  if (!byId) return Response.json(UNAVAILABLE, { status: 502 })

  const rows = [...new Set(ids)].flatMap((id) => {
    const lib = byId[id]

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
