import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"

const limiter = createRateLimiter({
  name: "suggestion-votes",
  max: 60,
  windowMs: 60000,
})
const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// POST /api/option-suggestions/:id/vote — add or remove the viewer's vote.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  const { id } = await params
  if (!/^[a-z0-9]{20,32}$/i.test(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const res = await fetch(
    `${STRAPI}/api/content-moderation/option-suggestions/${id}/vote`,
    { method: "POST", headers: userHeaders(session.user) }
  )
  const json = await res.json().catch(() => ({}))

  return NextResponse.json(json, { status: res.status })
}
