import {
  ATLAS_LIMITS,
  atlasAccessFilter,
  atlasAggregation,
  atlasMeiliFilter,
  atlasPoint,
  atlasResolveScope,
  atlasTimezoneCatalog,
  type AtlasAggregateCell,
  type AtlasBounds,
  type AtlasDictionary,
  type AtlasProjection,
  type AtlasScope,
} from "@repo/shared-data"

import { indexNames, request } from "./runtime.js"

export interface SearchResult {
  hits: AtlasProjection[]
  estimatedTotalHits: number
  processingTimeMs: number
  facetDistribution?: Record<string, Record<string, number>>
}
export interface Dataset {
  physicalRecords: number
  mapped: number
  listed: number
  evaluatedAt: string
  dictionary: AtlasDictionary
  fullScale: boolean
}
export const zones = atlasTimezoneCatalog()
export async function search(
  body: Record<string, unknown>
): Promise<SearchResult> {
  return request<SearchResult>(`/indexes/${indexNames.atlas}/search`, body)
}
export function exactTotal(result: SearchResult): number {
  const count = result.facetDistribution?.locale?.en
  if (count === undefined) {
    if (result.estimatedTotalHits === 0) return 0
    throw new Error("Missing exact canonical locale facet")
  }

  return count
}
export function filter(scope: AtlasScope, dataset: Dataset): string {
  return atlasMeiliFilter(atlasResolveScope(scope, dataset.dictionary), {
    now: new Date(dataset.evaluatedAt),
    timezones: zones,
  })
}
export async function aggregate(
  scope: AtlasScope & { bbox: AtlasBounds },
  dataset: Dataset
): Promise<{
  exactTotal: number
  cells: AtlasAggregateCell[]
  bytes: number
  processingTimeMs: number
}> {
  const selected = atlasAggregation(scope.bbox)
  const field = `atlas_cell_${selected.zoom}`
  const body = {
    filter: filter(scope, dataset),
    limit: 0,
    facets: ["locale", field],
  }
  const result = await search(body)
  const total = exactTotal(result)
  const counts = result.facetDistribution?.[field] ?? {}
  const allowed = new Set(selected.cells.map((c) => c.id))
  if (
    Object.keys(counts).some((id) => !allowed.has(id)) ||
    Object.values(counts).reduce((sum, n) => sum + n, 0) !== total
  )
    throw new Error("Incomplete Atlas cell facet")
  const cells = selected.cells.flatMap((c) =>
    counts[c.id] ? [{ ...c, total: counts[c.id]! }] : []
  )

  return {
    exactTotal: total,
    cells,
    bytes: Buffer.byteLength(JSON.stringify(cells)),
    processingTimeMs: result.processingTimeMs,
  }
}
export async function currentGeometry(
  scope: AtlasScope & { bbox: AtlasBounds },
  dataset: Dataset
): Promise<unknown> {
  const body = { filter: filter(scope, dataset), facets: ["locale"], limit: 0 }
  const total = exactTotal(await search(body))
  if (total > ATLAS_LIMITS.points)
    return {
      mode: "aggregate",
      complete: true,
      ...(await aggregate(scope, dataset)),
    }
  const points = await search({ ...body, limit: ATLAS_LIMITS.points })
  if (points.hits.length !== exactTotal(points))
    throw new Error("Incomplete current point response")

  return {
    mode: "points",
    exactTotal: points.hits.length,
    complete: true,
    points: points.hits.map(atlasPoint),
  }
}
export async function accessCoverage(
  scope: AtlasScope,
  dataset: Dataset
): Promise<{
  total: number
  matches: number
  partial: number
  unconfirmed: number
}> {
  const resolved = atlasResolveScope(scope, dataset.dictionary)
  const base = atlasMeiliFilter(resolved, {
    now: new Date(dataset.evaluatedAt),
    timezones: zones,
    ignoreAccessView: true,
  })
  const counts = await Promise.all(
    [
      base,
      `${base} AND ${atlasAccessFilter(resolved)}`,
      `${base} AND ${atlasAccessFilter(resolved, "any")}`,
    ].map(async (f) =>
      exactTotal(await search({ filter: f, limit: 0, facets: ["locale"] }))
    )
  )
  const [total, matches, any] = counts as [number, number, number]
  if (matches > any || any > total)
    throw new Error("Invalid concurrent accessibility coverage")

  return {
    total,
    matches,
    partial: any - matches,
    unconfirmed: total - matches,
  }
}
