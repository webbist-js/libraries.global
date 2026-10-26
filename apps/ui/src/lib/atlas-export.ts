import "server-only"

import {
  ATLAS_LIMITS,
  atlasKeysetFilter,
  atlasLongitude,
  atlasMatchesProjection,
  atlasResolveScope,
  parseAtlasQueryRequest,
  type AtlasExportRequest,
  type AtlasProjection,
} from "@repo/shared-data"

import type { AtlasBackend, AtlasBackendState } from "./atlas-backend"
import { AtlasQueryEngine } from "./atlas-query"
import type { LibraryExportSource } from "./export-format"
import { fetchExportRows } from "./library-export-bridge"

export class AtlasExportLimit extends Error {
  constructor(readonly limit: number) {
    super("Too many libraries for one export")
  }
}
export class AtlasExportConflict extends Error {
  constructor() {
    super("Atlas changed or is catching up. Retry the export.")
  }
}
export function parseAtlasExport(input: unknown): {
  request: AtlasExportRequest
  format: "csv" | "geojson"
} {
  const raw = input as Record<string, unknown>
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some(
      (key) =>
        !["schemaVersion", "scope", "sort", "centre", "format"].includes(key)
    ) ||
    !["csv", "geojson"].includes(String(raw.format))
  )
    throw new RangeError("Invalid Atlas export")
  const query = parseAtlasQueryRequest({
    schemaVersion: raw.schemaVersion,
    purpose: "list",
    scope: raw.scope,
    sort: raw.sort,
    centre: raw.centre,
  })
  if (query.purpose !== "list") throw new RangeError("Invalid Atlas export")

  return {
    format: raw.format as "csv" | "geojson",
    request: {
      schemaVersion: 1,
      scope: query.scope,
      sort: query.sort,
      centre: query.centre,
    },
  }
}
const bytes = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value))
const distance = (
  row: AtlasProjection,
  centre: AtlasExportRequest["centre"]
): number => {
  const radians = Math.PI / 180,
    lat = centre.lat * radians,
    target = row.latitude * radians,
    longitude = (row.longitude - atlasLongitude(centre.lng)) * radians

  return (
    Math.sin((target - lat) / 2) ** 2 +
    Math.cos(lat) * Math.cos(target) * Math.sin(longitude / 2) ** 2
  )
}

export async function selectAtlasExport(
  backend: AtlasBackend,
  request: AtlasExportRequest,
  cap: number,
  now: Date
): Promise<{ rows: AtlasProjection[]; state: AtlasBackendState }> {
  if (!Number.isInteger(cap) || cap < 1 || cap > 50000)
    throw new AtlasExportLimit(Math.max(0, cap))
  const state = await backend.state()
  if (BigInt(state.indexedThrough) < BigInt(state.projectionRevision))
    throw new AtlasExportConflict()
  const engine = new AtlasQueryEngine(backend, state, now),
    base = engine.filter(request.scope)
  if ((await engine.count(request.scope)) > cap) throw new AtlasExportLimit(cap)
  const field = request.sort.startsWith("place")
    ? "place_sort"
    : request.sort.startsWith("record")
      ? "completeness"
      : request.sort === "distance"
        ? "atlas_id"
        : "name_sort"
  const descending = request.sort.endsWith("_desc")
  const rows: AtlasProjection[] = []
  let continuation = "",
    allocated = 0
  while (rows.length <= cap) {
    const response = await backend.search({
      filter: `${base}${continuation ? ` AND ${continuation}` : ""}`,
      sort: [`${field}:${descending ? "desc" : "asc"}`, "atlas_id:asc"],
      limit: Math.min(ATLAS_LIMITS.exportBatch, cap + 1 - rows.length),
      attributesToRetrieve: [
        "documentId",
        "atlas_id",
        "name_sort",
        "place_sort",
        "completeness",
        "latitude",
        "longitude",
      ],
    })
    if (!response.hits.length) break
    rows.push(...response.hits)
    allocated += bytes(response.hits) * 3 + response.hits.length * 256
    if (rows.length > cap) throw new AtlasExportLimit(cap)
    if (allocated > 128 * 1024 * 1024)
      throw new AtlasExportLimit(rows.length - response.hits.length)
    const last = response.hits.at(-1)!
    continuation =
      field === "atlas_id"
        ? `atlas_id > ${last.atlas_id}`
        : atlasKeysetFilter(
            field,
            last[field] ?? null,
            last.atlas_id,
            descending
          )
    if (response.hits.length < ATLAS_LIMITS.exportBatch) break
  }
  if (request.sort === "distance")
    rows.sort(
      (a, b) =>
        distance(a, request.centre) - distance(b, request.centre) ||
        a.atlas_id - b.atlas_id
    )

  return { rows, state }
}

/** All authoritative data and consistency checks complete before file headers. */
export async function fetchAtlasExport(
  backend: AtlasBackend,
  request: AtlasExportRequest,
  cap: number,
  signal: AbortSignal
): Promise<LibraryExportSource[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      signal.throwIfAborted()
      const now = new Date(),
        selected = await selectAtlasExport(backend, request, cap, now),
        authoritative: LibraryExportSource[] = []
      let allocated = bytes(selected.rows) * 3 + selected.rows.length * 256
      const secret = process.env.STRAPI_BRIDGE_SECRET
      if (!secret) throw new Error("Export bridge is unavailable")
      for (
        let offset = 0;
        offset < selected.rows.length;
        offset += ATLAS_LIMITS.exportBatch
      ) {
        signal.throwIfAborted()
        const ids = selected.rows
          .slice(offset, offset + ATLAS_LIMITS.exportBatch)
          .map((row) => row.documentId)
        const rows = await fetchExportRows(ids, secret, { signal })
        if (!rows) throw new Error("Authoritative export data unavailable")
        if (rows.size !== ids.length) throw new AtlasExportConflict()
        const ordered = ids.map((id) => rows.get(id)!)
        allocated += bytes(ordered) * 3 + ordered.length * 1024
        if (allocated > 256 * 1024 * 1024) throw new AtlasExportLimit(offset)
        authoritative.push(...ordered)
      }
      const after = await backend.state()
      if (
        after.queryEpoch !== selected.state.queryEpoch ||
        after.dictionary.version !== selected.state.dictionary.version ||
        BigInt(after.indexedThrough) < BigInt(after.projectionRevision)
      )
        throw new AtlasExportConflict()
      const validation = await backend.bridge("/api/atlas/export-validation", {
        since: selected.state.indexedThrough,
        through: after.projectionRevision,
        queryEpoch: selected.state.queryEpoch,
        dictionaryVersion: selected.state.dictionary.version,
      })
      const resolved = atlasResolveScope(
        request.scope,
        selected.state.dictionary
      )
      if (
        validation.stable !== true ||
        !Array.isArray(validation.changes) ||
        validation.changes.some(
          (change: {
            old_projection: AtlasProjection | null
            new_projection: AtlasProjection | null
          }) =>
            [change.old_projection, change.new_projection].some(
              (row) => row && atlasMatchesProjection(row, resolved, now)
            )
        )
      )
        throw new AtlasExportConflict()

      return authoritative
    } catch (error) {
      if (!(error instanceof AtlasExportConflict) || attempt === 1) throw error
    }
  }
  throw new AtlasExportConflict()
}
