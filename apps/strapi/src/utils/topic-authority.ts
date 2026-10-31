import { bridgeBaUserId } from "./service-secret"
import { loadCallerCapabilities } from "./staff"

// Topic status is shared across translations, so locale-limited grants cannot
// authorize this operation. API tokens and client-supplied roles never suffice.
export async function requireTopicModerator(
  strapi: unknown,
  ctx: {
    request: { headers: Record<string, unknown> }
    unauthorized: (message: string) => unknown
    forbidden: (message: string) => unknown
  }
) {
  const actor = bridgeBaUserId(ctx)
  if (!actor) {
    ctx.unauthorized("Unauthorized")

    return false
  }
  const caps = await loadCallerCapabilities(strapi, actor)
  if (
    !caps.moderation.some(
      (scope) =>
        (scope.queue === "index" || scope.queue === "all") &&
        scope.locale === null
    )
  ) {
    ctx.forbidden("Topic moderation requires an unrestricted index grant")

    return false
  }

  return true
}
