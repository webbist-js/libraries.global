import { revalidateTag } from "next/cache"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

const limiter = createRateLimiter({
  name: "option-suggest",
  max: 10,
  windowMs: 60_000,
})

// GET /api/option-suggestions — open suggestions, with the viewer's votes.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  const res = await fetch(
    `${STRAPI}/api/content-moderation/option-suggestions`,
    {
      headers: session?.user ? userHeaders(session.user) : {},
      cache: "no-store",
    }
  )
  const json = await res.json().catch(() => ({ data: [] }))

  return NextResponse.json(json, { status: res.ok ? 200 : res.status })
}

// POST /api/option-suggestions — suggest a new accessibility feature,
// amenity, service or library type. Strapi validates the list, name and
// duplicates; this route only forwards the three string fields it accepts.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json(
      { error: { message: "Sign in to suggest an option." } },
      { status: 401 }
    )

  const forbidden = requireCapability(session.user, "submit.correction")
  if (forbidden) return forbidden

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  let body: { optionKey?: unknown; name?: unknown; description?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid request body" } },
      { status: 400 }
    )
  }

  const { optionKey, name, description } = body
  const payload: Record<string, string> = {}
  if (typeof optionKey === "string") payload.optionKey = optionKey
  if (typeof name === "string") payload.name = name
  if (typeof description === "string") payload.description = description

  const res = await fetch(
    `${STRAPI}/api/content-moderation/option-suggestions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session.user),
      },
      body: JSON.stringify(payload),
    }
  )
  const json = await res.json().catch(() => ({}))

  if (res.status === 201) revalidateTag("option-suggestions", "max")

  return NextResponse.json(json, { status: res.status })
}
