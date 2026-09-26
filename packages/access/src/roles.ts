export const CONTRIBUTOR_ROLES = [
  "reader",
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "editorial_board",
] as const
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number]

export function isContributorRole(v: unknown): v is ContributorRole {
  return (
    typeof v === "string" &&
    (CONTRIBUTOR_ROLES as readonly string[]).includes(v)
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
