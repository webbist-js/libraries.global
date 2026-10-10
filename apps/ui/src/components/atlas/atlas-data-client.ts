import {
  ATLAS_LIMITS,
  type AtlasChangesResponse,
  type AtlasDictionary,
  type AtlasManifest,
  type AtlasPoint,
  type AtlasQueryRequest,
  type AtlasQueryResponse,
  type AtlasScope,
  type AtlasViewportResponse,
} from "@repo/shared-data"

export interface AtlasGeneration {
  viewport: AtlasViewportResponse
  scope: AtlasScope
  dictionary: AtlasDictionary
  manifest: AtlasManifest | null
  changedIds: string[]
  upserts: AtlasPoint[]
}
const size = (input: unknown) =>
  new TextEncoder().encode(JSON.stringify(input)).length

export function mergeAtlasDelta(
  previous: { changedIds: string[]; upserts: AtlasPoint[] },
  delta: Extract<AtlasChangesResponse, { status: "complete" }>
) {
  const points = new Map(
    previous.upserts.map((point) => [point.properties.i, point])
  )
  const ids = new Set(previous.changedIds)
  for (const id of delta.removedIds) {
    ids.add(id)
    points.delete(id)
  }
  for (const point of delta.upserts) {
    ids.add(point.properties.i)
    points.set(point.properties.i, point)
  }
  const result = { changedIds: [...ids], upserts: [...points.values()] }
  if (
    ids.size > ATLAS_LIMITS.deltaIds ||
    size(result) > ATLAS_LIMITS.deltaBytes
  )
    throw new Error("Atlas reconciliation budget exceeded")

  return result
}
export async function atlasQuery<T extends AtlasQueryResponse>(
  request: AtlasQueryRequest,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch("/api/atlas/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
    cache: "no-store",
  })
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "Atlas changed. Refresh the results."
        : "Atlas data is temporarily unavailable."
    )
  const value = await response.json()
  if (
    value.schemaVersion !== 1 ||
    typeof value.queryEpoch !== "string" ||
    typeof value.indexedThrough !== "string"
  )
    throw new Error("Invalid Atlas generation")

  return value
}

/** Each request is a complete generation: tile baseline, mask and overlay
 * commit together. A new camera/filter request must never reuse an old mask. */
export async function loadAtlasGeneration(
  request: Extract<AtlasQueryRequest, { purpose: "viewport" }>,
  signal: AbortSignal
): Promise<AtlasGeneration> {
  const manifestResponse = await fetch("/api/atlas/manifest", {
    signal,
    cache: "no-store",
  })
  if (!manifestResponse.ok) throw new Error("Atlas is temporarily unavailable.")
  const { manifest, dictionary } = (await manifestResponse.json()) as {
    manifest: AtlasManifest | null
    dictionary: AtlasDictionary
  }
  const current = async (): Promise<AtlasGeneration> => {
    const viewport = await atlasQuery<AtlasViewportResponse>(
      { ...request, drawingPreference: "current" },
      signal
    )
    if (viewport.dictionaryVersion !== dictionary.version)
      throw new Error("Atlas options changed. Refresh the results.")

    return {
      viewport,
      dictionary,
      manifest: null,
      scope: request.scope,
      changedIds: [],
      upserts: [],
    }
  }
  if (
    request.drawingPreference === "current" ||
    !manifest ||
    request.scope.filters.opening !== "any" ||
    request.zoom < manifest.detailZoom
  )
    return current()
  try {
    const response = await fetch("/api/atlas/changes", {
      method: "POST",
      signal,
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        buildId: manifest.buildId,
        since: manifest.sourceStartRevision,
        bbox: request.scope.bbox,
      }),
    })
    if (!response.ok) throw new Error("Changes unavailable")
    const delta = (await response.json()) as AtlasChangesResponse
    if (delta.status !== "complete" || delta.buildId !== manifest.buildId)
      throw new Error("Archive window expired")
    const merged = mergeAtlasDelta({ changedIds: [], upserts: [] }, delta)
    const viewport = await atlasQuery<AtlasViewportResponse>(
      {
        ...request,
        archiveBuildId: manifest.buildId,
        drawingPreference: "auto",
      },
      signal
    )
    if (
      viewport.queryEpoch !== manifest.builtAgainstQueryEpoch ||
      viewport.indexedThrough !== delta.throughRevision ||
      viewport.dictionaryVersion !== dictionary.version
    )
      throw new Error("Atlas generation changed")

    return { viewport, manifest, dictionary, scope: request.scope, ...merged }
  } catch {
    signal.throwIfAborted()

    return current()
  }
}
