export const CONTRIBUTOR_ROLES = [
  "reader",
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "journal_editor",
  "moderator",
  "editorial_board",
] as const
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number]

/** Roles a Role Grant can carry. Reader is the absence of grants. */
export type GrantableRole = Exclude<ContributorRole, "reader">
export const GRANTABLE_ROLES: readonly GrantableRole[] =
  CONTRIBUTOR_ROLES.filter((r): r is GrantableRole => r !== "reader")

export function isContributorRole(v: unknown): v is ContributorRole {
  return (
    typeof v === "string" &&
    (CONTRIBUTOR_ROLES as readonly string[]).includes(v)
  )
}

export function isGrantableRole(v: unknown): v is GrantableRole {
  return (
    typeof v === "string" && (GRANTABLE_ROLES as readonly string[]).includes(v)
  )
}

/** Returns the higher of the two roles. Approvals may raise a role, never lower it. */
export function promoteRole(
  current: ContributorRole | null,
  target: ContributorRole
): ContributorRole {
  if (!current) return target

  return CONTRIBUTOR_ROLES.indexOf(current) >= CONTRIBUTOR_ROLES.indexOf(target)
    ? current
    : target
}

/** The highest role among these grants, or "reader" when there are none. */
export function highestRole(
  grants: readonly { role: GrantableRole }[]
): ContributorRole {
  return grants.reduce<ContributorRole>(
    (best, g) => promoteRole(best, g.role),
    "reader"
  )
}
