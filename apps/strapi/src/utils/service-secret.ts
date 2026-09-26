import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Constant-time check of the Next.js ↔ Strapi bridge secret
 * (`X-Service-Secret` header). Returns false when the secret is unset so a
 * missing env var can never open the endpoint.
 */
export function isValidServiceSecret(provided: unknown): boolean {
  const expected = process.env.STRAPI_BRIDGE_SECRET
  if (!expected || typeof provided !== "string" || provided.length === 0)
    return false

  // Hash both sides so lengths match and timingSafeEqual cannot throw.
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()

  return timingSafeEqual(a, b)
}
