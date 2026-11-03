import { createHmac, timingSafeEqual } from "node:crypto"

export const LIVE_CONFIRM_HOURS = 12
export type LiveProof = { userId: string; sessionId: string; expiresAt: number }
const secret = () => process.env.MOBILE_LIVE_STEPUP_SECRET

export function signLiveProof(
  userId: string,
  sessionId: string,
  now = Date.now()
): string {
  const key = secret()
  if (!key) throw new Error("Live confirmation is not configured")
  const body = Buffer.from(
    JSON.stringify({
      userId,
      sessionId,
      expiresAt: now + LIVE_CONFIRM_HOURS * 3_600_000,
    })
  ).toString("base64url")

  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`
}
export function readLiveProof(
  value: string | undefined,
  userId: string,
  sessionId: string,
  now = Date.now()
): LiveProof | null {
  if (!value || !secret()) return null
  const [body, sig, extra] = value.split(".")
  if (!body || !sig || extra) return null
  const expected = createHmac("sha256", secret()!)
    .update(body)
    .digest("base64url")
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as LiveProof

    return data.userId === userId &&
      data.sessionId === sessionId &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > now &&
      data.expiresAt <= now + LIVE_CONFIRM_HOURS * 3_600_000 + 60_000
      ? data
      : null
  } catch {
    return null
  }
}
export const liveCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: LIVE_CONFIRM_HOURS * 3600,
}
