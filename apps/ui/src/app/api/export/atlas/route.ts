import { headers } from "next/headers"
import { z } from "zod"

import { requireEntitlement } from "@/lib/access-server"
import { createAtlasBackend } from "@/lib/atlas-backend"
import {
  AtlasExportConflict,
  AtlasExportLimit,
  fetchAtlasExport,
  parseAtlasExport,
} from "@/lib/atlas-export"
import {
  scalableAtlasEnabled,
  atlasCohortFromHeaders,
} from "@/lib/atlas-rollout"
import { auth } from "@/lib/auth"
import {
  DOCUMENT_ID_PATTERN,
  MAX_ID_LENGTH,
  readJsonCapped,
} from "@/lib/bridge-params"
import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRow,
  csvChunks,
  EXPORT_ATTRIBUTION,
  geoJsonChunks,
  MAX_EXPORT_IDS,
} from "@/lib/export-format"
import { fetchExportRows } from "@/lib/library-export-bridge"
import { routing } from "@/lib/navigation"
import { absoluteUrl } from "@/lib/seo/metadata"

export const runtime = "nodejs"
export const maxDuration = 120

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

/** The encoder's text chunks as bytes, encoding one chunk per read. */
function byteStream(chunks: Iterator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    pull(controller) {
      const next = chunks.next()
      if (next.done) controller.close()
      else controller.enqueue(encoder.encode(next.value))
    },
    cancel() {
      chunks.return?.()
    },
  })
}

/** The plan's export row cap. Missing or malformed limits mean 0. */
function exportRowCap(user: { limits?: unknown }): number {
  const cap = (user.limits as { exportRows?: unknown } | null | undefined)
    ?.exportRows

  return typeof cap === "number" && Number.isFinite(cap) ? cap : 0
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
  const cap = exportRowCap(session!.user)
  if (scalableAtlasEnabled(atlasCohortFromHeaders(req.headers))) {
    let parsed: ReturnType<typeof parseAtlasExport>
    try {
      parsed = parseAtlasExport(raw.body)
    } catch {
      return Response.json({ error: "Invalid Atlas scope" }, { status: 400 })
    }
    try {
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(115000)])
      const libraries = await fetchAtlasExport(
        createAtlasBackend(signal),
        parsed.request,
        cap,
        signal
      )

      return exportFile(
        parsed.format,
        libraries.map((lib) => atlasExportRow(lib, pageUrl))
      )
    } catch (error) {
      if (error instanceof AtlasExportLimit)
        return Response.json(
          { error: error.message, limit: error.limit },
          { status: 413 }
        )
      if (error instanceof AtlasExportConflict)
        return Response.json({ error: error.message }, { status: 409 })

      return Response.json(UNAVAILABLE, { status: 503 })
    }
  }
  const parsed = ExportBody.safeParse(raw.body)
  if (!parsed.success)
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  const { format, ids } = parsed.data

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

  // Each id once, at its first place in the request: the file's row order.
  const unique = [...new Set(ids)]
  const byId = await fetchExportRows(unique, secret)
  if (!byId) return Response.json(UNAVAILABLE, { status: 502 })

  const rows = unique.flatMap((id) => {
    const lib = byId.get(id)

    return lib ? [atlasExportRow(lib, pageUrl)] : []
  })

  return exportFile(format, rows)
}

function exportFile(
  format: "csv" | "geojson",
  rows: ReturnType<typeof atlasExportRow>[]
) {
  const chunks =
    format === "csv"
      ? csvChunks(rows, ATLAS_EXPORT_COLUMNS)
      : geoJsonChunks(rows)
  const date = new Date().toISOString().slice(0, 10)

  // Streamed, as a big file passes Vercel's 4.5 MB limit on buffered bodies.
  // Before go-live, try one large export once on a Vercel preview deploy.
  return new Response(byteStream(chunks), {
    headers: {
      "Content-Type": FILE_TYPES[format],
      "Content-Disposition": `attachment; filename="libraries-global-atlas-${date}.${format}"`,
      "X-Data-Attribution": EXPORT_ATTRIBUTION,
      "X-Exported-Rows": String(rows.length),
      "Cache-Control": "no-store",
    },
  })
}
