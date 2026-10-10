import "server-only"

import type {
  AtlasDictionary,
  AtlasManifest,
  AtlasProjection,
} from "@repo/shared-data"

export interface AtlasBackendState {
  schemaVersion: 1
  queryEpoch: string
  dictionary: AtlasDictionary
  canonicalLocale: string
  projectionRevision: string
  indexedThrough: string
  journalFloor: string
  clockDue: string | null
  heartbeatAt: string | null
  manifest: AtlasManifest | null
}
export interface AtlasSearchResult {
  hits: (AtlasProjection & { _geoDistance?: number })[]
  estimatedTotalHits: number
  facetDistribution?: Record<string, Record<string, number>>
  facetStats?: Record<string, { min: number; max: number }>
}
export interface AtlasBackend {
  state: () => Promise<AtlasBackendState>
  search: (body: Record<string, unknown>) => Promise<AtlasSearchResult>
  bridge: (path: string, body?: unknown) => Promise<any>
}
async function boundedJson(response: Response, bytes: number): Promise<any> {
  if (!response.ok) throw new Error(`Atlas backend HTTP ${response.status}`)
  if (!response.body) throw new Error("Atlas backend body missing")
  const reader = response.body.getReader(),
    parts: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > bytes) throw new Error("Atlas backend byte budget exceeded")
      parts.push(chunk.value)
    }

    return JSON.parse(Buffer.concat(parts).toString("utf8"))
  } finally {
    await reader.cancel().catch(() => {})
  }
}
const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not configured`)

  return value
}

export function createAtlasBackend(signal?: AbortSignal): AtlasBackend {
  // A request may have several parallel facet groups. Bound their combined
  // concurrency, rather than giving each group a separate pool of twelve.
  let searching = 0
  const pending: (() => void)[] = []
  const enter = async () => {
    if (searching >= 12)
      await new Promise<void>((resolve) => pending.push(resolve))
    else searching++
  }
  const leave = () => {
    const next = pending.shift()
    if (next) next()
    else searching--
  }
  const bridge = async (path: string, body?: unknown) =>
    boundedJson(
      await fetch(new URL(path, required("STRAPI_URL")), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "x-service-secret": required("STRAPI_BRIDGE_SECRET"),
          "x-atlas-token": required("ATLAS_SERVICE_TOKEN"),
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000),
      }),
      8 * 1024 * 1024
    )

  return {
    bridge,
    async state() {
      const state = await bridge("/api/atlas/state")
      if (
        state.schemaVersion !== 1 ||
        typeof state.queryEpoch !== "string" ||
        !state.dictionary?.version ||
        !Array.isArray(state.dictionary.entries) ||
        typeof state.canonicalLocale !== "string" ||
        !/^\d{1,19}$/.test(state.indexedThrough) ||
        !/^\d{1,19}$/.test(state.projectionRevision)
      )
        throw new Error("Invalid Atlas backend state")

      return state
    },
    async search(body) {
      await enter()
      try {
        const response = await boundedJson(
          await fetch(
            new URL(
              "/indexes/atlas-library/search",
              required("MEILI_ATLAS_HOST")
            ),
            {
              method: "POST",
              headers: {
                authorization: `Bearer ${required("MEILI_ATLAS_SEARCH_KEY")}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(body),
              cache: "no-store",
              redirect: "error",
              signal: signal
                ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
                : AbortSignal.timeout(10000),
            }
          ),
          8 * 1024 * 1024
        )
        if (
          !Array.isArray(response.hits) ||
          typeof response.estimatedTotalHits !== "number"
        )
          throw new Error("Invalid Atlas search response")

        return response
      } finally {
        leave()
      }
    },
  }
}
