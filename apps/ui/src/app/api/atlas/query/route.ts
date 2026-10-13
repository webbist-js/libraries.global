import { requireEntitlement } from "@/lib/access-server"
import { createAtlasBackend } from "@/lib/atlas-backend"
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
        result =
          readAtlasCache(key) ??
          (await new AtlasQueryEngine(backend, state, now).execute(
            input.request
          )),
        after = await backend.state()
      if (
        state.queryEpoch === after.queryEpoch &&
        state.dictionary.version === after.dictionary.version &&
        state.indexedThrough === after.indexedThrough
      ) {
        writeAtlasCache(key, result)

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
}
