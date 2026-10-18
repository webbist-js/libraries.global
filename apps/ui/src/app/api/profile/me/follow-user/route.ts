import { isExistingProfileTarget } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET
const Username = z.string().refine(isExistingProfileTarget)
const FollowBody = z
  .object({ username: Username, action: z.enum(["follow", "unfollow"]) })
  .strict()

const limiter = createRateLimiter({
  name: "follow-user",
  max: 30,
  windowMs: 60_000,
})

function missingSecret() {
  return NextResponse.json({ error: "Bridge not configured" }, { status: 500 })
}

export async function GET(req: Request) {
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUsername = searchParams.get("targetUsername")
  if (!Username.safeParse(targetUsername).success)
    return NextResponse.json(
      { error: "Missing targetUsername" },
      { status: 400 }
    )

  const url = `${STRAPI}/api/auth-bridge/user-follow-status?baUserId=${encodeURIComponent(session.user.id)}&targetUsername=${encodeURIComponent(targetUsername!)}`
  const res = await fetch(url, {
    headers: { "X-Service-Secret": SECRET },
    cache: "no-store",
  })
  if (!res.ok)
    return NextResponse.json(
      { error: "Follow status unavailable" },
      { status: 503 }
    )

  const json = await res.json()

  return NextResponse.json(json)
}

export async function POST(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const parsed = await readTypedJson(req, 4096, FollowBody)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const { username, action } = parsed.body

  const res = await fetch(`${STRAPI}/api/auth-bridge/toggle-follow-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      targetUsername: username,
      action,
    }),
  })

  if (res.status === 403) {
    return NextResponse.json(
      { error: "This profile cannot be followed" },
      { status: 403 }
    )
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update follow" },
      { status: 500 }
    )

  const json = await res.json()

  return NextResponse.json(json)
}
