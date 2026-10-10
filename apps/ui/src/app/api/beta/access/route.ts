import { NextResponse } from "next/server"
import { z } from "zod"

import {
  BETA_COOKIE,
  BETA_MAX_AGE,
  betaConfigured,
  betaDestination,
  betaEnabled,
  createBetaPass,
  matchesBetaPassword,
  sameOriginRequest,
} from "@/lib/beta/access"
import { betaAttemptLimit } from "@/lib/beta/attempts"
import { readJsonCapped } from "@/lib/bridge-params"
import { rateLimitResponse } from "@/lib/rate-limit"

const bodySchema = z
  .object({
    password: z.string().min(1).max(512),
    next: z.string().max(2048).optional(),
  })
  .strict()
const response = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return response("origin", 403)
  if (!betaEnabled()) return response("disabled", 404)
  if (!betaConfigured()) return response("unavailable", 503)
  const parsed = await readJsonCapped(req, 4096)
  if (!parsed.ok) return response("invalid", parsed.status)
  const body = bodySchema.safeParse(parsed.body)
  if (!body.success) return response("invalid", 400)
  try {
    const limit = await betaAttemptLimit(req)
    if (!limit.ok) {
      const limited = rateLimitResponse(limit)
      limited.headers.set("Cache-Control", "no-store")

      return limited
    }
  } catch {
    return response("unavailable", 503)
  }
  if (!matchesBetaPassword(body.data.password)) return response("password", 401)
  const accepted = NextResponse.json(
    { ok: true, next: betaDestination(body.data.next) },
    { headers: { "Cache-Control": "no-store" } }
  )
  accepted.cookies.set(BETA_COOKIE, createBetaPass(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BETA_MAX_AGE,
  })

  return accepted
}
