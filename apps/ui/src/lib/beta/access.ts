import { createHmac, timingSafeEqual } from "node:crypto"

import { betaPath } from "@/lib/beta/scope"

export const BETA_COOKIE = "lg-beta-access"
export const BETA_MAX_AGE = 30 * 24 * 60 * 60
export const betaEnabled = () => process.env.BETA_GATE_ENABLED === "true"
export const betaConfigured = () =>
  (process.env.BETA_ACCESS_SECRET?.length ?? 0) >= 32
export type BetaPass = { invitationId: string; expiresAt: number }

function signature(payload: string) {
  if (!betaConfigured()) throw new Error("Beta access is unavailable")

  return createHmac("sha256", process.env.BETA_ACCESS_SECRET!)
    .update(`individual-beta:${payload}`)
    .digest()
}

export function createBetaPass(grant: BetaPass): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...grant,
      version: process.env.BETA_ACCESS_VERSION ?? "1",
    })
  ).toString("base64url")

  return `${payload}.${signature(payload).toString("base64url")}`
}

/** A valid signature is only the first check; the CMS must also confirm the grant is active. */
export function readBetaPass(
  pass: string | undefined,
  now = Date.now()
): BetaPass | null {
  if (!pass || pass.length > 1024 || !betaConfigured()) return null
  try {
    const [payload, supplied, extra] = pass.split(".")
    if (
      !payload ||
      !supplied ||
      extra !== undefined ||
      !/^[\w-]{43}$/.test(supplied)
    )
      return null
    const expected = signature(payload)
    const given = Buffer.from(supplied, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      return null
    const value = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (
      value.version !== (process.env.BETA_ACCESS_VERSION ?? "1") ||
      typeof value.invitationId !== "string" ||
      !/^[a-z0-9]{20,32}$/.test(value.invitationId) ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= now ||
      value.expiresAt > now + BETA_MAX_AGE * 1000
    )
      return null

    return { invitationId: value.invitationId, expiresAt: value.expiresAt }
  } catch {
    return null
  }
}

/** Signature/expiry only. Protected requests use hasBetaAccess for CMS revocation checks. */
export const validBetaPass = (pass: string | undefined, now = Date.now()) =>
  readBetaPass(pass, now) !== null

/** Never let a supplied continuation escape this origin or re-enter the gate. */
export function betaDestination(value: unknown, fallback = "/"): string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((char) => char.codePointAt(0)! <= 32)
  )
    return fallback
  try {
    const url = new URL(value, "https://beta.invalid")
    const decoded = decodeURIComponent(url.pathname)
    if (
      url.origin !== "https://beta.invalid" ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      Array.from(decoded).some((char) => char.codePointAt(0)! <= 32) ||
      /^\/beta(?:\/|$)/.test(betaPath(decoded)) ||
      /^\/(?:api|_next)(?:\/|$)/.test(decoded)
    )
      return fallback

    return `${url.pathname}${url.search}`
  } catch {
    return fallback
  }
}

export function sameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin || req.headers.get("sec-fetch-site") === "cross-site")
    return false

  // Self-hosted Next.js constructs req.url from its internal listen address.
  // The configured production origin stays authoritative behind the proxy.
  const expected =
    process.env.NODE_ENV === "production" ? process.env.APP_PUBLIC_URL : req.url
  if (!expected) return false
  try {
    return origin === new URL(expected).origin
  } catch {
    return false
  }
}
