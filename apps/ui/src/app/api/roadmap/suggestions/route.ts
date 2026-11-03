import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const limiter = createRateLimiter({
  name: "roadmap-suggestions",
  max: 5,
  windowMs: 60_000,
})
const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""))

// POST /api/roadmap/suggestions — suggest an open dataset. Strapi keeps it
// as a draft until a moderator publishes it.
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
    return NextResponse.json(
      { error: { message: "Sign in to suggest a dataset." } },
      { status: 401 }
    )
  const forbidden = requireCapability(session.user, "submit.correction")
  if (forbidden) return forbidden
  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)
  const parsed = await readTypedJson(
    req,
    8192,
    z.object({
      place: z.string().trim().min(2).max(120),
      source: z.string().trim().min(2).max(200),
      sourceUrl: z
        .string()
        .trim()
        .max(2048)
        .regex(/^https?:\/\//i)
        .optional()
        .or(z.literal("")),
      licence: optional(200),
      notes: optional(1000),
    })
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: { message: "Check the dataset details." } },
      { status: parsed.status }
    )

  const res = await fetch(`${STRAPI}/api/roadmap/suggestions`, {
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
