import { authDbPool } from "@/lib/auth"
import { sendLiveConfirmationEmail } from "@/lib/email"
import {
  confirmationLocked,
  newConfirmationCode,
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
  if (!session.user.emailVerified)
    return errorResponse("verify_email_first", 403)
  if (
    !(await liveRateLimit(
      `${session.user.id}:confirmation-code`,
      5,
      15 * 60_000
    ))
  )
    return errorResponse("too_many_requests", 429)
  try {
    const locked = await withConfirmation(
      authDbPool,
      session.user.id,
      async (state) => {
        if (confirmationLocked(state)) return true
        const code = newConfirmationCode(
          state,
          session.user.id,
          session.session.id
        )
        await sendLiveConfirmationEmail(session.user.email, code)

        return false
      }
    )

    return locked
      ? errorResponse("confirmation_locked", 429)
      : Response.json({ sent: true }, { headers: LIVE_HEADERS })
  } catch {
    return errorResponse("email_unavailable", 503)
  }
}
