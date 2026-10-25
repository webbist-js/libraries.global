import { requireEntitlement } from "@/lib/access-server"
import { createAtlasBackend } from "@/lib/atlas-backend"
import {
  parseContextQuery,
  type AtlasContextRelease,
} from "@/lib/atlas-context"
import { auth } from "@/lib/auth"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

export const runtime = "nodejs"
const requests = createRateLimiter({
  name: "atlas-context",
  max: 360,
  windowMs: 60_000,
})
let catalogue: {
  until: number
  value: Promise<{ schemaVersion: 1; releases: AtlasContextRelease[] }>
} | null = null
function releases() {
  if (catalogue && catalogue.until > Date.now()) return catalogue.value
  const entry = {
    until: Date.now() + 60_000,
    value: createAtlasBackend(AbortSignal.timeout(15000)).bridge(
      "/api/atlas/context?kind=catalogue"
    ),
  }
  catalogue = entry
  entry.value.catch(() => {
    if (catalogue === entry) catalogue = null
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
  let params: URLSearchParams
  try {
    params = parseContextQuery(new URL(req.url).searchParams)
  } catch {
    return Response.json({ error: "Invalid context request" }, { status: 400 })
  }
  try {
    const available: { schemaVersion: 1; releases: AtlasContextRelease[] } =
      await releases()
    if (
      available.schemaVersion !== 1 ||
      !Array.isArray(available.releases) ||
      available.releases.length > 128
    )
      throw new Error("Invalid context catalogue")
    if ((params.get("kind") ?? "catalogue") === "catalogue")
      return Response.json(available, {
        headers: { "cache-control": "private, max-age=60" },
      })
    const release = available.releases.find(
      (r) => r.id === params.get("release")
    )
    if (!release)
      return Response.json(
        { error: "Context release unavailable" },
        { status: 404 }
      )
    if (release.theme === "deprivation" || release.theme === "carAccess") {
      const denied = requireEntitlement(session.user, "atlas.analysis")
      if (denied) return denied
    }
    const result = await createAtlasBackend(req.signal).bridge(
      `/api/atlas/context?${params}`
    )
    if (params.get("kind") === "tile") {
      if (
        typeof result.png !== "string" ||
        result.png.length > 350000 ||
        !/^[A-Za-z0-9+/=]+$/.test(result.png)
      )
        throw new Error("Invalid context tile")

      return new Response(Buffer.from(result.png, "base64"), {
        headers: {
          "content-type": "image/png",
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      })
    }

    return Response.json(result, {
      headers: { "cache-control": "private, max-age=60" },
    })
  } catch {
    return Response.json(
      { error: "Map context is temporarily unavailable" },
      { status: 503 }
    )
  }
}
