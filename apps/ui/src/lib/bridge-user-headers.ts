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
    "X-Ba-User-Name": user.name ?? "",
  }
}

/** The name the API routes use for the same headers. */
export const userHeaders = bridgeUserHeaders
