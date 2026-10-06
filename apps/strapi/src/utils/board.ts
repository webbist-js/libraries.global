import { highestRole } from "@repo/access"

import { activeGrants } from "./role-grants"

/**
 * True when the Better Auth user's highest unexpired Role Grant is
 * `editorial_board`. Drives are board-run: every board-only Strapi route
 * (create, update, act) gates on this, re-checking the caller's live grants
 * rather than trusting anything the client sends.
 */
export async function isBoardMember(
  strapi: any,
  baUserId: string
): Promise<boolean> {
  const grants = await activeGrants(strapi, baUserId)

  return highestRole(grants) === "editorial_board"
}
