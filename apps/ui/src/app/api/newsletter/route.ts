import { NextResponse } from "next/server"
import { z } from "zod"

import { readJsonCapped } from "@/lib/bridge-params"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

const HOUR = 60 * 60 * 1000

// Five sign-ups an hour per address: a person retrying a typo, not a script.
const limiter = createRateLimiter({
  name: "newsletter",
  max: 5,
  windowMs: HOUR,
})

const BodySchema = z.object({
  email: z.email().max(254),
  // Honeypot: a hidden field people never fill in. Anything in it is a bot.
  website: z.string().max(0).optional(),
})

// POST /api/newsletter — newsletter sign-up, forwarded to Strapi's
// bridge-secret-gated subscribers action with the client address.
export async function POST(req: Request) {
  const parsed = await readJsonCapped(req, 4 * 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )

  const body = BodySchema.safeParse(parsed.body)
  if (!body.success)
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })

  const ip = clientIp(req)
  const limit = await limiter.check(ip)
  if (!limit.ok) return rateLimitResponse(limit)

  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return NextResponse.json(
      { error: "Sign-up is not available right now" },
      { status: 503 }
    )
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

  let res: Response
  try {
    res = await fetch(`${strapiUrl}/api/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ email: body.data.email }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { error: "Sign-up failed. Please try again later." },
      { status: 502 }
    )
  }

  // 409: already subscribed. Say nothing different, so the form can't be
  // used to find out who is on the list.
  if (res.ok || res.status === 409) return NextResponse.json({ ok: true })

  return NextResponse.json(
    { error: "Sign-up failed. Please try again later." },
    { status: 502 }
  )
}
