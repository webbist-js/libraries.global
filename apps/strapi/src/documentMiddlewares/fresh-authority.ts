import type { Core } from "@strapi/strapi"
import { errors } from "@strapi/utils"

import { requireFreshAdminAuth } from "../utils/fresh-admin-auth"

const AUTHORITY = new Set([
  "api::role-grant.role-grant",
  "api::library-affiliation.library-affiliation",
  "plugin::access.team-member",
  "plugin::access.library-authority-grant",
])
const WRITES = new Set([
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
  "discardDraft",
])

/** CMS admin operations and plugin writes use the original administrator login
 * time. Internal fulfilment/bootstrap and authenticated UI bridges retain their
 * own action-level authorization; no request means there is no browser session.
 */
export function registerFreshAuthorityMiddleware({
  strapi,
}: {
  strapi: Core.Strapi
}) {
  strapi.documents.use(async (context, next) => {
    const ctx = strapi.requestContext.get()
    if (
      AUTHORITY.has(context.uid) &&
      WRITES.has(context.action) &&
      ctx?.state?.user &&
      !(await requireFreshAdminAuth(strapi, ctx))
    )
      throw new errors.ForbiddenError(
        "Sign out and sign back in before changing account authority."
      )

    return next()
  })
}
