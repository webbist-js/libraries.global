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

/**
 * The Better Auth id a bridge-secret-gated request vouches for, from
 * `X-Ba-User-Id`. Trusted only alongside a valid `X-Service-Secret`; null
 * when either is missing, invalid or malformed. Shared by every route that
 * follows the `user-profile.ts` `bridgeBaUserId` pattern (board-only Drive
 * routes included).
 */
export function bridgeBaUserId(ctx: any): string | null {
  const headers = ctx.request?.headers ?? ctx.request?.header ?? {}
  if (!isValidServiceSecret(headers["x-service-secret"])) return null
  const id = headers["x-ba-user-id"]

  return typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null
}
