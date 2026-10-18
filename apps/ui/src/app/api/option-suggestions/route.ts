import { revalidateTag } from "next/cache"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { strapiServiceHeaders, userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

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
      headers: session?.user
        ? userHeaders(session.user)
        : strapiServiceHeaders(),
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
      { error: { message: "Sign in to suggest an option." } },
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
      optionKey: z.enum([
        "accessibility",
        "amenities",
        "services",
        "library_types",
      ]),
      name: z.string().trim().min(2).max(80),
      description: z.string().max(400).optional(),
      comparison: z
        .object({
          documentId: z.string().regex(/^[a-z0-9]{20,32}$/),
          explanation: z.string().trim().min(1).max(400),
        })
        .optional(),
    })
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid suggestion." },
      { status: parsed.status }
    )
  const payload = parsed.body

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
