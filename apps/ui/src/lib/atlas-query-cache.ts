import "server-only"
import { createHash } from "node:crypto"

import {
  atlasPopulationBaseline,
  atlasLocalGeography,
  type AtlasQueryRequest,
  type AtlasQueryResponse,
} from "@repo/shared-data"

import type { AtlasBackendState } from "@/lib/atlas-backend"

const cache = new Map<
  string,
  { expires: number; bytes: number; value: AtlasQueryResponse }
>()
let allocated = 0

export function atlasCacheKey(
  request: AtlasQueryRequest,
  state: AtlasBackendState,
  now: Date
): string | null {
  if (
    !["counts", "suggestions", "perCapita", "libraryAccess"].includes(
      request.purpose
    )
  )
    return null

  return createHash("sha256")
    .update(
      JSON.stringify([
        process.env.MEILI_ATLAS_HOST,
        request,
        request.purpose === "perCapita" || request.purpose === "libraryAccess"
          ? [atlasPopulationBaseline.version, atlasLocalGeography.version]
          : null,
        state.queryEpoch,
        state.dictionary.version,
        state.indexedThrough,
        Math.floor(now.getTime() / 60000),
      ])
    )
    .digest("hex")
}
export function readAtlasCache(
  key: string | null
): AtlasQueryResponse | undefined {
  if (!key) return
  const row = cache.get(key)
  if (row && row.expires > Date.now()) return row.value
  if (row) {
    allocated -= row.bytes
    cache.delete(key)
  }
}
export function writeAtlasCache(key: string | null, value: AtlasQueryResponse) {
  if (!key) return
  const bytes = Buffer.byteLength(JSON.stringify(value)) * 3
  if (bytes > 1024 * 1024) return
  const previous = cache.get(key)
  if (previous) {
    allocated -= previous.bytes
    cache.delete(key)
  }
  while (cache.size >= 64 || allocated + bytes > 8 * 1024 * 1024) {
    const first = cache.keys().next().value!
    allocated -= cache.get(first)!.bytes
    cache.delete(first)
  }
  cache.set(key, { bytes, value, expires: Date.now() + 15000 })
  allocated += bytes
}
