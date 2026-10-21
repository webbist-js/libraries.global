import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

const limiter = createRateLimiter({
  name: "suggest-topic",
  max: 30,
  windowMs: 60_000,
})

export async function POST(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const parsed = await readTypedJson(
    req,
    4096,
    z.object({ name: z.string().trim().min(2).max(100) }).strict()
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const { name } = parsed.body

  // Check for duplicates
  const topicRes = await fetch(`${STRAPI}/api/topics/approved`, {
    next: { revalidate: 0 },
  })
  if (topicRes.ok) {
    const existing = (await topicRes.json()) as {
      data: { name: string }[]
    }
    const duplicate = existing.data.find(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase()
    )
    if (duplicate)
      return NextResponse.json(
        { error: "Topic already exists" },
        { status: 409 }
      )
  }

  // Submit as moderation entry. Strapi resolves the submitter from the
  // X-Ba-User-* headers; a baUserId in the body is ignored.
  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...userHeaders(session.user),
    },
    body: JSON.stringify({
      submissionType: "topic_suggestion",
      fields: { name: name.trim() },
      note: `Topic suggestion: "${name.trim()}"`,
    }),
  })

  if (!res.ok)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
