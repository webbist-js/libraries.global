// Server-only entry point: deliberately excluded from the browser barrel.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

export type PreviewTarget = {
  url: string
  locale: string
  status: "draft" | "published"
}
const MAC_DOMAIN = "cms-preview-v1:"

export function signPreviewTicket(
  target: PreviewTarget,
  secret: string,
  now = Date.now()
) {
  if (!secret) throw new Error("Preview is not configured")
  const body = Buffer.from(
    JSON.stringify({ ...target, expiresAt: now + 60_000, nonce: randomUUID() })
  ).toString("base64url")

  return `${body}.${createHmac("sha256", secret)
    .update(MAC_DOMAIN + body)
    .digest("base64url")}`
}
export function readPreviewTicket(
  token: string,
  secret: string,
  now = Date.now()
): (PreviewTarget & { nonce: string; expiresAt: number }) | null {
  if (!secret || token.length > 4096) return null
  const [body, signature, extra] = token.split(".")
  if (!body || !signature || extra) return null
  const expected = createHmac("sha256", secret)
    .update(MAC_DOMAIN + body)
    .digest("base64url")
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString())
    if (
      typeof data.url !== "string" ||
      !/^\/(?!\/)[a-zA-Z0-9/%_-]*$/.test(data.url) ||
      !["en", "fr", "cs"].includes(data.locale) ||
      !["draft", "published"].includes(data.status) ||
      typeof data.nonce !== "string" ||
      !/^[a-f0-9-]{36}$/.test(data.nonce) ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= now ||
      data.expiresAt > now + 60_000
    )
      return null

    return data
  } catch {
    return null
  }
}
