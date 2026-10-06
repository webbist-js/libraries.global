import "server-only"

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto"

type StatePayload = {
  nonce: string
  userId: string
  libraryDocumentId: string
  exp: number
}

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")

  return Buffer.from(
    hkdfSync("sha256", secret, "", "event-feed-oauth-state", 32)
  )
}

const sign = (body: string) =>
  createHmac("sha256", key()).update(body).digest("base64url")

/** A signed, expiring OAuth `state` for the Eventbrite connect flow. */
export function signState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")

  return `${body}.${sign(body)}`
}

export function verifyState(token: string): StatePayload | null {
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null
  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StatePayload
    if (typeof p.exp !== "number" || p.exp < Date.now()) return null

    return p
  } catch {
    return null
  }
}
