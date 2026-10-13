import { createHmac, timingSafeEqual } from "node:crypto"

import { betaPath } from "@/lib/beta/scope"

export const BETA_COOKIE = "lg-beta-access"
export const BETA_MAX_AGE = 30 * 24 * 60 * 60
export const betaEnabled = () => process.env.BETA_GATE_ENABLED === "true"

export function betaConfigured(): boolean {
  return (
    !!process.env.BETA_PASSWORD &&
    (process.env.BETA_ACCESS_SECRET?.length ?? 0) >= 32
  )
}

function signingKey() {
  if (!betaConfigured()) throw new Error("Beta access is unavailable")

  // Password rotation revokes every pass, even if the operator forgets to bump version.
  return createHmac("sha256", process.env.BETA_ACCESS_SECRET!)
    .update(process.env.BETA_PASSWORD!)
    .digest()
}

export function matchesBetaPassword(password: string): boolean {
  if (!betaConfigured()) return false
  const expected = createHmac("sha256", signingKey())
    .update(process.env.BETA_PASSWORD!)
    .digest()
  const actual = createHmac("sha256", signingKey()).update(password).digest()

  return timingSafeEqual(expected, actual)
}

export function createBetaPass(now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({
      expiresAt: now + BETA_MAX_AGE * 1000,
      version: process.env.BETA_ACCESS_VERSION ?? "1",
    })
  ).toString("base64url")

  return `${payload}.${createHmac("sha256", signingKey()).update(payload).digest("base64url")}`
}

export function validBetaPass(
  pass: string | undefined,
  now = Date.now()
): boolean {
  if (!pass || pass.length > 1024 || !betaConfigured()) return false
  const [payload, signature, extra] = pass.split(".")
  if (!payload || !signature || extra !== undefined) return false
  if (!/^[\w-]{43}$/.test(signature)) return false
  const expected = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url")
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return false
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())

    return (
      data.version === (process.env.BETA_ACCESS_VERSION ?? "1") &&
      Number.isSafeInteger(data.expiresAt) &&
      data.expiresAt > now &&
      data.expiresAt <= now + BETA_MAX_AGE * 1000
    )
  } catch {
    return false
  }
}

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
