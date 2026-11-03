import { headers } from "next/headers"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { STRAPI } from "@/lib/saved-events-bridge"
import { SAVED_VIEW_KINDS, savedViewLimit } from "@/lib/saved-views"
import { readTypedJson } from "@/lib/typed-json"

const saves = createRateLimiter({
  name: "saved-views",
  max: 30,
  windowMs: 60_000,
})

/** The bridge headers and the session user, or null when signed out. */
async function bridge() {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  return {
    user: session.user,
    headers: { "X-Service-Secret": secret, "X-Ba-User-Id": session.user.id },
  }
}

/** GET /api/saved-views?kind=view|search: the account's saved items. */
export async function GET(req: Request) {
  const context = await bridge()
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const kind = new URL(req.url).searchParams.get("kind")
  if (kind && !(SAVED_VIEW_KINDS as readonly string[]).includes(kind))
    return Response.json({ error: "Unknown kind" }, { status: 400 })

  const res = await fetch(
    `${STRAPI}/api/saved-views${kind ? `?kind=${kind}` : ""}`,
    { headers: context.headers, cache: "no-store" }
  ).catch(() => null)
  if (!res?.ok)
    return Response.json({ error: "Saved views unavailable" }, { status: 503 })

  return Response.json(await res.json(), {
    headers: { "Cache-Control": "private, no-store" },
  })
}

/** POST /api/saved-views { kind, name, query }, within the plan's limit. */
export async function POST(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const context = await bridge()
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const rate = await saves.check(context.user.id)
  if (!rate.ok) return rateLimitResponse(rate)

  const parsed = await readTypedJson(
    req,
    8192,
    z
      .object({
        kind: z.enum(SAVED_VIEW_KINDS),
        name: z.string().trim().min(1).max(80),
        query: z.string().max(2000),
      })
      .strict()
  )
  if (!parsed.ok)
    return Response.json({ error: "Invalid saved view" }, { status: 400 })
  const limit = savedViewLimit(
    (context.user as { limits?: unknown }).limits,
    parsed.body.kind
  )

  const res = await fetch(`${STRAPI}/api/saved-views`, {
    method: "POST",
    headers: {
      ...context.headers,
      "Content-Type": "application/json",
      "X-Saved-Limit": String(limit),
    },
    body: JSON.stringify(parsed.body),
  }).catch(() => null)
  if (!res)
    return Response.json({ error: "Saved views unavailable" }, { status: 503 })

  return Response.json(await res.json().catch(() => ({})), {
    status: res.status,
  })
}
