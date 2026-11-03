import { errors } from "@strapi/utils"

import { moderationActor } from "../utils/moderation-actor"

/** Native route policy backed by the existing locale/queue-scoped role grants. */
export default async function moderation(
  ctx: any,
  _config: unknown,
  { strapi }: { strapi: any }
) {
  const result = await moderationActor(strapi, ctx)
  if ("actor" in result) return true
  if (result.status === 401) throw new errors.UnauthorizedError(result.message)
  throw new errors.ForbiddenError(result.message)
}
