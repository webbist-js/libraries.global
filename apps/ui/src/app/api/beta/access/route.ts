import { NextResponse } from "next/server"
import { z } from "zod"

import {
  BETA_COOKIE,
  BETA_MAX_AGE,
  betaConfigured,
  betaDestination,
  betaEnabled,
  createBetaPass,
  sameOriginRequest,
} from "@/lib/beta/access"
import { betaAttemptLimit } from "@/lib/beta/attempts"
import { redeemBetaInvitation } from "@/lib/beta/invitations"
import { readJsonCapped } from "@/lib/bridge-params"
import { rateLimitResponse } from "@/lib/rate-limit"

const bodySchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{43}$/),
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
  let grant
  try {
    grant = await redeemBetaInvitation(body.data.code)
  } catch {
    return response("unavailable", 503)
  }
  if (!grant) return response("invitation", 401)
  const accepted = NextResponse.json(
    { ok: true, next: betaDestination(body.data.next) },
    { headers: { "Cache-Control": "no-store" } }
  )
  accepted.cookies.set(BETA_COOKIE, createBetaPass(grant), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BETA_MAX_AGE,
  })

  return accepted
}
