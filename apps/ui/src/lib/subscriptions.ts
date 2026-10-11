import "server-only"

import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { NextResponse } from "next/server"
import { z } from "zod"

import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped } from "@/lib/bridge-params"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

export type SubscriberType = "beta_waitlist" | "newsletter"
const limiters = {
  beta_waitlist: createRateLimiter({
    name: "beta-waitlist",
    max: 5,
    windowMs: 3600000,
  }),
  newsletter: createRateLimiter({
    name: "newsletter",
    max: 5,
    windowMs: 3600000,
  }),
}
const schema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    website: z.string().max(0).optional(),
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    source: z.enum(["footer", "journal"]).optional(),
  })
  .strict()
const fail = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )

export async function collectSubscription(req: Request, type: SubscriberType) {
  // Existing newsletter callers may omit Origin; reject an explicit cross-origin request.
  if (
    (type === "beta_waitlist" || req.headers.has("origin")) &&
    !sameOriginRequest(req)
  )
    return fail("Invalid origin", 403)
  const parsed = await readJsonCapped(req, 4096)
  if (!parsed.ok) return fail("Invalid request body", parsed.status)
  const body = schema.safeParse(parsed.body)
  if (!body.success) return fail("Invalid email", 400)
  const ip = clientIp(req)
  const limit = await limiters[type].check(ip)
  if (!limit.ok) return rateLimitResponse(limit)
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return fail("Sign-up is not available right now", 503)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Service-Secret": secret,
    "X-Forwarded-For": ip,
  }
  // Waitlist collection never reads or links a user session.
  if (type === "newsletter" && req.headers.has("cookie")) {
    const { auth } = await import("@/lib/auth")
    const session = await auth.api
      .getSession({ headers: req.headers })
      .catch(() => null)
    if (session?.user?.emailVerified) {
      if (session.user.email.toLowerCase() !== body.data.email)
        return fail("Use your account email for a newsletter subscription", 400)
      headers["X-Ba-User-Id"] = session.user.id
      headers["X-Ba-User-Email"] = session.user.email
    }
  }
  try {
    const res = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/subscribers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: body.data.email,
          type,
          source:
            type === "beta_waitlist"
              ? "beta_landing"
              : (body.data.source ?? "footer"),
          locale: body.data.locale ?? "en",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )
    if (res.ok)
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } }
      )
    if (res.status === 429) {
      const retry = res.headers.get("retry-after")

      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": /^\d{1,6}$/.test(retry ?? "") ? retry! : "3600",
          },
        }
      )
    }

    return fail("Sign-up failed. Please try again later.", 502)
  } catch {
    return fail("Sign-up failed. Please try again later.", 502)
  }
}
