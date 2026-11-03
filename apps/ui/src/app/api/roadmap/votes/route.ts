import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const limiter = createRateLimiter({
  name: "roadmap-votes",
  max: 60,
  windowMs: 60_000,
})
const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// POST /api/roadmap/votes — set or clear the viewer's vote on one item.
export async function POST(req: Request) {
  if (
    !isSameOrigin(
      req,
      process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL
    )
  )
    return sameOriginResponse()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 })
  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)
  const parsed = await readTypedJson(
    req,
    1024,
    z.object({
      key: z.string().regex(/^(?=.{1,60}$)[a-z0-9]+(?:-[a-z0-9]+)*$/),
      voted: z.boolean(),
    })
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid vote." },
      { status: parsed.status }
    )

  const res = await fetch(`${STRAPI}/api/roadmap/votes`, {
    method: "POST",
    headers: {
      ...userHeaders(session.user),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsed.body),
  })
  const json = await res.json().catch(() => ({}))

  return NextResponse.json(json, { status: res.status })
}
