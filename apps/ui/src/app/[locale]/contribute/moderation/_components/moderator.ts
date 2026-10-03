import "server-only"

import { MODERATION_QUEUES, type ModerationScope } from "@repo/access"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import type { ModerationQueueName } from "@/components/moderation"
import { hasCapability, sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"

/**
 * The signed-in Moderator and their Moderation Scopes, from the session.
 * Signs in first when there is no session; a 404 without `moderate.queue`,
 * so the pages don't announce themselves. Strapi re-checks every request.
 */
export async function requireModerator(callbackPath: string) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
  const user = session.user
  if (!hasCapability(user, "moderate.queue")) notFound()

  return { user, scopes: sessionCapabilities(user).moderation }
}

/** The queues any scope covers, in the canonical order. */
export function queuesOf(
  scopes: readonly ModerationScope[]
): ModerationQueueName[] {
  if (scopes.some((s) => s.queue === "all")) return [...MODERATION_QUEUES]

  return MODERATION_QUEUES.filter((q) => scopes.some((s) => s.queue === q))
}

/** Whether the scopes include the editorial board's `{ all, any locale }`. */
export const coversEverything = (scopes: readonly ModerationScope[]) =>
  scopes.some((s) => s.queue === "all" && s.locale === null)
