import "server-only"

import { MODERATION_QUEUES, type ModerationScope } from "@repo/access"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import type { ModerationQueueName } from "@/components/moderation"
import { hasCapability, sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"

export type ModeratorAccess = "ok" | "denied" | "unknown"

/**
 * What the session says about moderating. `unknown` when the session
 * profile never loaded (`profileLoaded: false`: the bridge timed out or
 * failed), so the session carries no capabilities for a reason that has
 * nothing to do with the viewer's roles; a page then says so and offers a
 * retry instead of a 404. A loaded session without `moderate.queue`, or a
 * session with no access fields at all, is denied.
 */
export function moderatorAccess(
  user: { capabilities?: unknown; profileLoaded?: unknown } | null | undefined
): ModeratorAccess {
  if (!user) return "denied"
  if (hasCapability(user, "moderate.queue")) return "ok"

  return user.profileLoaded === false ? "unknown" : "denied"
}

/**
 * The signed-in Moderator and their Moderation Scopes, from the session.
 * Signs in first when there is no session; a 404 without `moderate.queue`,
 * so the pages don't announce themselves. `accessUnknown` is true when the
 * session's roles couldn't be read: the page renders
 * `ModerationAccessUnavailable` rather than deciding either way. Strapi
 * re-checks every request.
 */
export async function requireModerator(callbackPath: string) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
  const user = session.user
  const access = moderatorAccess(user)
  if (access === "denied") notFound()

  return {
    user,
    scopes: sessionCapabilities(user).moderation,
    accessUnknown: access === "unknown",
  }
}

/** The queues any scope covers, in the canonical order. */
export function queuesOf(
  scopes: readonly ModerationScope[]
): ModerationQueueName[] {
  const articleQueues = MODERATION_QUEUES.filter(
    (queue): queue is ModerationQueueName => queue !== "discussions"
  )
  if (scopes.some((s) => s.queue === "all")) return [...articleQueues]

  return articleQueues.filter((q) => scopes.some((s) => s.queue === q))
}

/** Whether the scopes include the editorial board's `{ all, any locale }`. */
export const coversEverything = (scopes: readonly ModerationScope[]) =>
  scopes.some((s) => s.queue === "all" && s.locale === null)
