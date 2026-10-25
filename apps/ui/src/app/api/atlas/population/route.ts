import type {
  AtlasPopulationLevel,
  AtlasPopulationDensityResponse,
} from "@repo/shared-data"

import { createAtlasBackend } from "@/lib/atlas-backend"
import { queryPopulationDensity } from "@/lib/atlas-population-density"
import { auth } from "@/lib/auth"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

export const runtime = "nodejs"
const requests = createRateLimiter({
  name: "atlas-population",
  max: 60,
  windowMs: 60_000,
})
const cached = new Map<
  string,
  { expires: number; value: Promise<AtlasPopulationDensityResponse> }
>()

function load(level: AtlasPopulationLevel, country: string) {
  const key = `${level}:${country}`
  const known = cached.get(key)
  if (known && known.expires > Date.now()) return known.value
  // Fixed country/level profiles, shared observations, no user/filter data.
  // A caller abort must not cancel another reader's shared request.
  const entry = {
    expires: Date.now() + 60_000,
    value: queryPopulationDensity(
      createAtlasBackend(AbortSignal.timeout(15000)),
      level,
      country
    ),
  }
  cached.set(key, entry)
  entry.value.catch(() => {
    if (cached.get(key) === entry) cached.delete(key)
  })

  return entry.value
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const rate = await requests.check(session.user.id)
  if (!rate.ok) return rateLimitResponse(rate)
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json({ error: "Atlas unavailable" }, { status: 503 })
  const params = new URL(req.url).searchParams
  const level = params.get("level") ?? "countries"
  const country = params.get("country") ?? "GB"
  if (
    [...params.keys()].some(
      (key) =>
        !["level", "country"].includes(key) || params.getAll(key).length !== 1
    ) ||
    !["GB", "SE", "NO", "DK", "FI", "AX"].includes(country) ||
    !["countries", "regions", "local"].includes(level)
  )
    return Response.json(
      { error: "Invalid population geography" },
      { status: 400 }
    )
  try {
    const response = await load(level as AtlasPopulationLevel, country)

    return Response.json(response, {
      headers: { "cache-control": "private, max-age=60" },
    })
  } catch {
    return Response.json(
      { error: "Population data is temporarily unavailable" },
      { status: 503 }
    )
  }
}
