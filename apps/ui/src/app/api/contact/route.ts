import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped } from "@/lib/bridge-params"
import { sendContactNotification } from "@/lib/contact/email"
import { contactSubmissionSchema } from "@/lib/contact/schema"
import { queueFeedbackNotification } from "@/lib/contact/slack"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

export const runtime = "nodejs"
const limiter = createRateLimiter({
  name: "contact",
  max: 5,
  windowMs: 3600000,
})
const fail = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return fail("origin", 403)
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) {
    const response = rateLimitResponse(limit)
    response.headers.set("Cache-Control", "no-store")

    return response
  }
  const parsed = await readJsonCapped(req, 20000)
  if (!parsed.ok) return fail("invalid", parsed.status)
  const body = contactSubmissionSchema.safeParse(parsed.body)
  if (!body.success) return fail("invalid", 400)
  // A filled hidden website field is a bot submission, never an email.
  if (body.data.website)
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  const reference = randomUUID()
  const userAgent = (req.headers.get("user-agent") ?? "")
    .replaceAll(/[\r\n]/g, " ")
    .slice(0, 512)
  try {
    const queued = await queueFeedbackNotification(body.data, reference)
    try {
      await sendContactNotification(body.data, userAgent, reference)
    } catch {
      // Persisted feedback is accepted even when its email copy is unavailable.
      // Contact-only requests still require their existing email delivery.
      if (!queued) throw new Error("Contact delivery unavailable")
    }

    return NextResponse.json(
      { ok: true, reference },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return fail("unavailable", 503)
  }
}
