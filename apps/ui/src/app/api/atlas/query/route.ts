import { requireEntitlement } from "@/lib/access-server"
import { createAtlasBackend, type AtlasBackendState } from "@/lib/atlas-backend"
import { AtlasCursorExpired } from "@/lib/atlas-cursor"
import { AtlasQueryEngine } from "@/lib/atlas-query"
import {
  atlasCacheKey,
  readAtlasCache,
  writeAtlasCache,
} from "@/lib/atlas-query-cache"
import { readAtlasQuery } from "@/lib/atlas-query-validation"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"
export const maxDuration = 30

function sameGeneration(before: AtlasBackendState, after: AtlasBackendState) {
  return (
    before.queryEpoch === after.queryEpoch &&
    before.dictionary.version === after.dictionary.version &&
    before.indexedThrough === after.indexedThrough &&
    before.manifest?.buildId === after.manifest?.buildId
  )
}

function queryError(error: unknown) {
  if (error instanceof AtlasCursorExpired)
    return Response.json({ error: error.message }, { status: 409 })

  console.error(
    "[atlas-query]",
    error instanceof Error ? error.message : "Query failed"
  )

  return Response.json(
    { error: "Atlas data is temporarily unavailable. Try again shortly." },
    { status: 503 }
  )
}

export async function POST(req: Request) {
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json(
      { error: "Atlas queries are unavailable", code: "ATLAS_DISABLED" },
      { status: 503 }
    )
  const input = await readAtlasQuery(req)
  if ("response" in input) return input.response
  if (["perCapita", "libraryAccess"].includes(input.request.purpose)) {
    const session = await auth.api.getSession({ headers: req.headers })
    const denied = requireEntitlement(session?.user, "atlas.analysis")
    if (denied) return denied
  }
  const backend = createAtlasBackend(
    AbortSignal.any([req.signal, AbortSignal.timeout(25000)])
  )
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const state = await backend.state(),
        now = new Date(),
        key = atlasCacheKey(input.request, state, now),
        cached = readAtlasCache(key),
        result =
          cached ??
          (await new AtlasQueryEngine(backend, state, now).execute(
            input.request
          )),
        after = await backend.state()
      if (sameGeneration(state, after)) {
        if (!cached) writeAtlasCache(key, result)

        return Response.json(result, {
          headers: { "cache-control": "no-store" },
        })
      }
    }

    return Response.json(
      { error: "Atlas changed; refresh and retry" },
      { status: 409 }
    )
  } catch (error) {
    return queryError(error)
  }
}
