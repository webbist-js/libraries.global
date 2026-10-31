import "server-only"
import { createHmac } from "node:crypto"

import { boundedLibraryQuery } from "@repo/shared-data"
import qs from "qs"

import { clientIp } from "./rate-limit"

/** Durable across UI instances, with the existing expiring rate-limit store. */
export async function allowLibraryLookup(request: Request) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return false
  const { authDbPool } = await import("./auth")
  const key = `library-lookup:${createHmac("sha256", secret).update(clientIp(request)).digest("hex")}`
  const result = await authDbPool.query<{ hits: number }>(
    "insert into billing_rate_limits(key,hits,resets_at) values($1,1,now()+interval '1 minute') on conflict(key) do update set hits=case when billing_rate_limits.resets_at<=now() then 1 else billing_rate_limits.hits+1 end,resets_at=case when billing_rate_limits.resets_at<=now() then now()+interval '1 minute' else billing_rate_limits.resets_at end returning hits",
    [key]
  )

  return (result.rows[0]?.hits ?? 1000) <= 60
}

export async function checkLibraryLookup(request: Request) {
  const incoming = new URL(request.url)
  try {
    if (incoming.search.length > 8192) throw new Error("query_too_large")
    boundedLibraryQuery(
      qs.parse(incoming.search, {
        ignoreQueryPrefix: true,
        depth: 8,
        parameterLimit: 300,
      }) as Record<string, unknown>
    )
  } catch {
    return Response.json({ error: "invalid_library_query" }, { status: 400 })
  }
  try {
    if (!(await allowLibraryLookup(request)))
      return Response.json(
        { error: "too_many_requests" },
        {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        }
      )
  } catch {
    return Response.json({ error: "lookup_unavailable" }, { status: 503 })
  }

  return null
}
