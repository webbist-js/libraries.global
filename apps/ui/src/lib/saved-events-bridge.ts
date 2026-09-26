import "server-only"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"

export const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/**
 * Headers for calling Strapi's saved-events API on behalf of the signed-in
 * user, or null when there is no session (or the bridge is not configured).
 * The user id always comes from the Better Auth session, never the request.
 */
export async function savedEventsBridgeHeaders(): Promise<Record<
  string,
  string
> | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  return { "X-Service-Secret": secret, "X-Ba-User-Id": session.user.id }
}
