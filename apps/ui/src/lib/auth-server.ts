import "server-only"

import type {
  Capability,
  ContributorRole,
  Feature,
  PlanKey,
  PlanSource,
} from "@repo/access"
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"

import { auth } from "./auth"

export type { Session } from "./auth"

export type BetterAuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
  // Added by customSession (lib/session-access.ts). Missing means deny.
  contributorRole?: ContributorRole | null
  username?: string | null
  profileLoaded?: boolean
  capabilities?: Capability[]
  claimedLibraryIds?: string[]
  plan?: PlanKey
  planSource?: PlanSource
  features?: Feature[]
}

export type BetterAuthSession = {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuthSessionResult = {
  user: BetterAuthUser
  session: BetterAuthSession
} | null

/**
 * Retrieve the current Better Auth session from the Next.js auth handler.
 * Returns null (never throws) so pages degrade gracefully when session is
 * unavailable, expired, or BA encounters a transient DB error.
 */
export async function getSessionSSR(
  headers: ReadonlyHeaders
): Promise<AuthSessionResult> {
  try {
    const session = await auth.api.getSession({
      headers: headers as unknown as Headers,
    })

    return session as AuthSessionResult
  } catch {
    return null
  }
}
