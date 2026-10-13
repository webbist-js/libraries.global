import {
  parseAtlasScope,
  atlasRevision,
  emptyAtlasFilters,
} from "@repo/shared-data"

import { createAtlasBackend } from "@/lib/atlas-backend"
import { readJsonCapped } from "@/lib/bridge-params"

export const runtime = "nodejs"
export async function POST(req: Request) {
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json(
      { error: "Atlas queries are unavailable" },
      { status: 503 }
    )
  const input = await readJsonCapped(req, 16 * 1024)
  if (!input.ok)
    return Response.json(
      { error: "Invalid Atlas change request" },
      { status: input.status }
    )
  let body: { buildId: string; since: string; bbox: unknown }
  try {
    const raw = input.body as any
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).some(
        (key) => !["buildId", "since", "bbox"].includes(key)
      ) ||
      typeof raw.buildId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(raw.buildId) ||
      typeof raw.since !== "string" ||
      raw.since.length > 19 ||
      !/^(0|[1-9]\d*)$/.test(raw.since) ||
      BigInt(raw.since) > 9223372036854775807n
    )
      throw new Error("Invalid change window")
    const scope = parseAtlasScope({
      bbox: raw.bbox,
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    })
    if (!scope.bbox) throw new Error("Viewport required")
    body = {
      buildId: raw.buildId,
      since: atlasRevision(raw.since),
      bbox: scope.bbox,
    }
  } catch {
    return Response.json(
      { error: "Invalid Atlas change request" },
      { status: 400 }
    )
  }
  try {
    const response = await createAtlasBackend(req.signal).bridge(
      "/api/atlas/changes",
      body
    )
    if (
      !["complete", "overflow", "expired"].includes(response.status) ||
      response.schemaVersion !== 1
    )
      throw new Error("Invalid change response")

    return Response.json(response, { headers: { "cache-control": "no-store" } })
  } catch {
    return Response.json(
      { error: "Atlas changes are temporarily unavailable" },
      { status: 503 }
    )
  }
}
