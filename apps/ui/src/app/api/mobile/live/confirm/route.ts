import { cookies } from "next/headers"

import { auth, authDbPool } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import {
  liveCookieOptions,
  readLiveProof,
  signLiveProof,
} from "@/lib/live-proof"
import {
  checkConfirmationCode,
  confirmationLocked,
  recordFailure,
  withConfirmation,
} from "@/lib/mobile-live/confirmation-store"
import {
  errorResponse,
  liveIdentity,
  liveRateLimit,
  LIVE_HEADERS,
} from "@/lib/mobile-live/proxy"

export async function POST(req: Request) {
  const identity = await liveIdentity(req)
  if (identity.error) return identity.error
  const session = identity.session!
  // Five attempts a quarter hour, on top of the lockout.
  if (
    !(await liveRateLimit(
      `${session.user.id}:POST:live/confirm`,
      5,
      15 * 60_000
    ))
  )
    return errorResponse("too_many_requests", 429)
  const parsed = await readJsonCapped(req, 4096)
  if (!parsed.ok || !parsed.body || typeof parsed.body !== "object")
    return errorResponse("invalid_body", 400)
  const body = parsed.body as {
    method?: string
    password?: string
    code?: string
  }
  let newlyLocked = false
  const status = await withConfirmation(
    authDbPool,
    session.user.id,
    async (state) => {
      if (confirmationLocked(state)) return "locked"
      let ok = false
      if (
        body.method === "password" &&
        typeof body.password === "string" &&
        body.password.length <= 1024
      ) {
        const result = await auth.api
          .verifyPassword({
            headers: req.headers,
            body: { password: body.password },
          })
          .catch(() => null)
        ok = result?.status === true
      } else if (body.method === "code")
        ok =
          session.user.emailVerified &&
          checkConfirmationCode(
            state,
            session.user.id,
            session.session.id,
            body.code
          )
      else if (body.method === "passkey")
        ok = Boolean(
          readLiveProof(
            (await cookies()).get("lg_live")?.value,
            session.user.id,
            session.session.id
          )
        )
      if (ok) {
        state.attempts = 0

        return "ok"
      }
      newlyLocked = recordFailure(state)

      return newlyLocked ? "locked" : "invalid"
    }
  )
  if (newlyLocked && process.env.STRAPI_BRIDGE_SECRET)
    await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/mobile-libraries/live/locked`,
      {
        method: "POST",
        headers: bridgeUserHeaders(session.user),
        signal: AbortSignal.timeout(5000),
      }
    ).catch(() => {})
  if (status !== "ok")
    return errorResponse(
      status === "locked" ? "confirmation_locked" : "confirmation_failed",
      status === "locked" ? 429 : 400
    )
  const cookieStore = await cookies()
  cookieStore.set(
    "lg_live",
    signLiveProof(session.user.id, session.session.id),
    liveCookieOptions
  )

  return Response.json({ confirmed: true }, { headers: LIVE_HEADERS })
}
