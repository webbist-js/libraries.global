import "server-only"
import { createHash } from "node:crypto"

import { cookies } from "next/headers"

import { requireStaff } from "@/lib/access-server"
import { auth, authDbPool } from "@/lib/auth"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { readLiveProof } from "@/lib/live-proof"
import { mobileRequestOrigin } from "@/lib/mobile-app"
import { isSameOrigin } from "@/lib/same-origin"

export const LIVE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(self)",
}
export const errorResponse = (code: string, status: number) =>
  Response.json({ error: { code } }, { status, headers: LIVE_HEADERS })

/** Uses BA's existing verification table; the atomic upsert holds across Next instances. */
export async function liveRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const id = `live-rate:${createHash("sha256").update(key).digest("hex")}`
  const resetAt = Date.now() + windowMs
  const { rows } = await authDbPool.query<{ value: string }>(
    `insert into "verification" (id,identifier,value,"expiresAt","createdAt","updatedAt") values ($1,$1,$2,$3,now(),now()) on conflict (id) do update set value=case when "verification"."expiresAt"<=now() then excluded.value else json_build_object('count',coalesce(("verification".value::json->>'count')::int,0)+1)::text end,"expiresAt"=case when "verification"."expiresAt"<=now() then excluded."expiresAt" else "verification"."expiresAt" end,"updatedAt"=now() returning value`,
    [id, JSON.stringify({ count: 1 }), new Date(resetAt)]
  )

  return JSON.parse(rows[0]!.value).count <= max
}

export async function liveIdentity(req: Request, mutation = true) {
  if (mutation && !isSameOrigin(req, mobileRequestOrigin(req)))
    return { error: errorResponse("cross_site_request", 403) }
  const session = await auth.api
    .getSession({ headers: req.headers })
    .catch(() => null)

  return session?.user
    ? { session }
    : { error: errorResponse("sign_in_required", 401) }
}

export async function proxyLive(
  req: Request,
  opts: {
    path: string
    method?: "GET" | "POST" | "PUT"
    id?: string
    action?: "goLive" | "manageLive" | "seeTeam"
    proof?: boolean
    keys?: string[]
    max: number
    windowMs: number
  }
): Promise<Response> {
  const method = opts.method ?? "GET"
  const identity = await liveIdentity(req, method !== "GET")
  if (identity.error) return identity.error
  const session = identity.session!
  if (opts.id) {
    if (!isDocumentIdParam(opts.id)) return errorResponse("invalid_id", 400)
    const denied = requireStaff(session.user, opts.id, opts.action ?? "goLive")
    if (denied) return denied
  }
  const proof = (await cookies()).get("lg_live")?.value
  if (opts.proof && !readLiveProof(proof, session.user.id, session.session.id))
    return errorResponse("confirmation_required", 401)
  if (
    !(await liveRateLimit(
      // One bucket per method: reads never spend a write's budget.
      `${session.user.id}:${method}:${opts.path.replaceAll(/\/[a-z0-9]{20,32}/g, "/id").replaceAll(/live\/(start|takeover)/g, "live/start")}`,
      opts.max,
      opts.windowMs
    ))
  )
    return errorResponse("too_many_requests", 429)
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return errorResponse("bridge_unavailable", 503)
  let body: string | undefined
  if (method !== "GET") {
    const parsed = await readJsonCapped(req, 50_000)
    if (!parsed.ok) return errorResponse("invalid_body", parsed.status)
    if (
      !parsed.body ||
      typeof parsed.body !== "object" ||
      Array.isArray(parsed.body)
    )
      return errorResponse("invalid_body", 400)
    if (opts.path === "live/start" || opts.path === "live/takeover") {
      const id = (parsed.body as Record<string, unknown>).libraryDocumentId
      if (typeof id !== "string" || !isDocumentIdParam(id))
        return errorResponse("invalid_id", 400)
      const denied = requireStaff(session.user, id, "goLive")
      if (denied) return denied
    }
    body = JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed.body).filter(([key]) => opts.keys?.includes(key))
      )
    )
  }
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/mobile-libraries/${opts.path}`,
      {
        method,
        body,
        headers: {
          ...bridgeUserHeaders(session.user),
          "Content-Type": "application/json",
          "X-Live-Proof": proof ?? "",
          "X-Ba-Session-Id": session.session.id,
          "X-Live-Token": req.headers.get("x-live-token") ?? "",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    )
    const result = Response.json(await response.json(), {
      status: response.status,
      headers: LIVE_HEADERS,
    })
    if (opts.path.endsWith("/end") && response.ok)
      result.headers.append(
        "Set-Cookie",
        "lg_live=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
      )

    return result
  } catch {
    return errorResponse("live_service_unavailable", 502)
  }
}
