import type { Core } from "@strapi/strapi"
import { errors } from "@strapi/utils"

import type { AuthRequestContext as Context } from "./request-context"

/** Reviewed public catalogue actions previously assigned to the Public role. */
export const PUBLIC_CONTENT_ACTIONS = [
  ...[
    "accessibility",
    "amenity",
    "area",
    "blog-article",
    "blog-section",
    "category",
    "continent",
    "country",
    "library",
    "page",
    "region",
    "service",
    "wiki-article",
    "wiki-section",
  ].flatMap((type) => [
    `api::${type}.${type}.find`,
    `api::${type}.${type}.findOne`,
  ]),
  ...["blog-landing", "footer", "homepage", "wiki-landing"].map(
    (type) => `api::${type}.${type}.find`
  ),
]

/** Native Strapi abilities retain relation sanitization without Users & Permissions. */
export function publicContentStrategy(strapi: Core.Strapi) {
  return {
    name: "public-content",
    async authenticate(ctx: Context) {
      // A bad/restricted bearer token must never fall back to anonymous access.
      if (
        ctx.request?.headers?.authorization ||
        !["GET", "HEAD"].includes(ctx.request?.method)
      )
        return { authenticated: false }

      return {
        authenticated: true,
        credentials: null,
        ability: await strapi.contentAPI.permissions.engine.generateAbility(
          PUBLIC_CONTENT_ACTIONS.map((action) => ({ action }))
        ),
      }
    },
    verify(
      auth: { ability?: { can: (scope: string) => boolean } },
      config: { scope?: string | string[] }
    ) {
      const scopes =
        typeof config.scope === "string" ? [config.scope] : config.scope
      if (
        !scopes?.length ||
        !scopes.every(
          (scope) =>
            PUBLIC_CONTENT_ACTIONS.includes(scope) && auth.ability?.can(scope)
        )
      )
        throw new errors.ForbiddenError()
    },
  }
}
