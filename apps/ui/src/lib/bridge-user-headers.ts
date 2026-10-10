/**
 * Headers for calling a Strapi content-moderation route on behalf of the
 * signed-in user: the bridge secret plus the identity Strapi's `resolveUser`
 * reads. The user always comes from the Better Auth session, never the
 * request body.
 */
export function bridgeUserHeaders(user: {
  id: string
  email: string
  name?: string | null
}): Record<string, string> {
  return {
    "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET ?? "",
    "X-Ba-User-Id": user.id,
    "X-Ba-User-Email": user.email,
    // Header values must be ByteStrings; names with accents, CJK or emoji
    // would make fetch throw. Strapi decodes this with decodeURIComponent.
    "X-Ba-User-Name": encodeURIComponent(user.name ?? ""),
  }
}

/** The name the API routes use for the same headers. */
export const userHeaders = bridgeUserHeaders

/** Anonymous server reads still come from the trusted application. */
export function strapiServiceHeaders(): Record<string, string> {
  return process.env.STRAPI_BRIDGE_SECRET
    ? { "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET }
    : {}
}
