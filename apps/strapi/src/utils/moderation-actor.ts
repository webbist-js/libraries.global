import type { Capabilities } from "@repo/access"

import { decodeHeaderName } from "./header-name"
import { bridgeBaUserId } from "./service-secret"

export type ModerationActor = {
  viewer: { id: string; email: string | null; name: string | null }
  caps: Capabilities
  role: string | null
}

/** One request-local projection. Resource scope and transaction guards remain in services. */
export async function moderationActor(
  strapi: any,
  ctx: any
): Promise<
  { actor: ModerationActor } | { status: 401 | 403; message: string }
> {
  if (ctx.state?.moderationActor) return { actor: ctx.state.moderationActor }
  const id = bridgeBaUserId(ctx)
  if (!id) return { status: 401, message: "Service secret and user required." }
  const { caps, role } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(id)
  if (!caps?.moderation?.length)
    return { status: 403, message: "You don't moderate any queue." }
  const value = (name: string) => {
    const raw = ctx.request?.headers?.[name]

    return typeof raw === "string" && raw.trim() ? raw.trim() : null
  }
  const actor: ModerationActor = {
    viewer: {
      id,
      email: value("x-ba-user-email"),
      name: decodeHeaderName(value("x-ba-user-name")),
    },
    caps,
    role: role ?? null,
  }
  ctx.state ??= {}
  ctx.state.moderationActor = actor

  return { actor }
}
