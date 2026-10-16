import type { Actor, DiscussionConfig } from "./contracts"
import { fail, safeUrl, text } from "./validation"

const memberActions = [
  "read",
  "createThread",
  "reply",
  "editOwn",
  "report",
  "subscribe",
  "react",
  "upload",
] as const

export async function resolveActor(
  strapi: any,
  config: DiscussionConfig,
  ctx: any
): Promise<Actor | null> {
  if (config.identity) {
    const actor = await config.identity(ctx, { strapi })
    if (!actor) return null
    if (actor.admin)
      return fail(401, "Community identity cannot be an administrator")

    return {
      key: text(actor.key, "identity key", 180),
      name: text(actor.name, "identity name", 120),
      capabilities: actor.capabilities?.filter((action) =>
        [...memberActions, "moderate", "sanction"].includes(action as any)
      ) ?? [...memberActions],
      profile: actor.profile
        ? {
            slug: actor.profile.slug
              ? text(actor.profile.slug, "profile slug", 120)
              : undefined,
            url: actor.profile.url ? safeUrl(actor.profile.url) : undefined,
          }
        : undefined,
    }
  }
  const plugin = strapi.plugin("users-permissions")
  if (!plugin || !ctx.request?.header?.authorization) return null
  let payload: any
  try {
    payload = await plugin.service("jwt").getToken(ctx)
  } catch {
    return fail(401, "Invalid authentication")
  }
  if (!payload?.id) return fail(401, "Invalid authentication")
  const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({ where: { id: payload.id }, populate: ["role"] })
  if (!user || user.blocked || (config.requireConfirmed && !user.confirmed))
    return fail(401, "Inactive account")

  return {
    key: `up:${user.id}`,
    name: text(user.username, "username", 120),
    capabilities: [
      ...memberActions,
      ...(config.moderatorRoleIds.includes(user.role?.id)
        ? ["moderate" as const]
        : []),
      ...(config.sanctionRoleIds.includes(user.role?.id)
        ? ["sanction" as const]
        : []),
    ],
  }
}
