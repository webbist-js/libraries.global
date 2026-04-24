import "server-only"

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"

export type BetterAuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: string
  updatedAt: string
}

export type BetterAuthSession = {
  id: string
  userId: string
  expiresAt: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuthSessionResult = {
  user: BetterAuthUser
  session: BetterAuthSession
} | null

/**
 * Retrieve the current Better Auth session from Strapi's auth endpoint.
 * Forwards the incoming request's cookie so the session cookie is included.
 * Must only be called from Server Components or Route Handlers.
 */
export async function getSessionSSR(
  headers: ReadonlyHeaders
): Promise<AuthSessionResult> {
  const strapiUrl = process.env.STRAPI_URL
  if (!strapiUrl) return null

  try {
    const res = await fetch(`${strapiUrl}/api/better-auth/get-session`, {
      headers: { cookie: headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    // Better Auth returns null when no session
    if (!data || !data.user) return null

    return data as AuthSessionResult
  } catch {
    return null
  }
}
