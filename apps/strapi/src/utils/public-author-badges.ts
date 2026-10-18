import type { PublicAuthorBadge } from "strapi-plugin-discussions/types"

import { activeGrants } from "./role-grants"

/** Informational public byline tags; permissions still use scoped authorization. */
export async function publicAuthorRoleBadges(
  strapi: any,
  userId: string
): Promise<PublicAuthorBadge[]> {
  const grants = await activeGrants(strapi, userId)
  if (grants.some((grant) => grant.role === "editorial_board"))
    return ["editorial_board"]

  const badges: PublicAuthorBadge[] = []
  if (
    grants.some((grant) =>
      ["wiki_editor", "journal_editor"].includes(grant.role)
    )
  )
    badges.push("editor")
  if (grants.some((grant) => grant.role === "moderator"))
    badges.push("moderator")

  return badges
}
