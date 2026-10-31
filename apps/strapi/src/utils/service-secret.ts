import { matchesBridgeSecret } from "@repo/shared-data/service-key"

/**
 * Constant-time check of the Next.js ↔ Strapi bridge secret
 * (`X-Service-Secret` header). Returns false when the secret is unset so a
 * missing env var can never open the endpoint.
 */
export function isValidServiceSecret(provided: unknown): boolean {
  return matchesBridgeSecret(provided)
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
