/** Shapes and labels for the People tab (contributor Role Grants). */

export type PersonRow = {
  baUserId: string
  documentId: string
  username: string | null
  displayName: string | null
  email: string | null
  contributorRole: string
  activeGrants: number
}

export type GrantStatus = "active" | "expired" | "revoked"

export type GrantRow = {
  documentId: string
  role: string
  queue: string
  locale: string | null
  source: string | null
  grantedBy: string | null
  reason: string | null
  expiresAt: string | null
  createdAt: string | null
  status: GrantStatus
}

export type Person = Omit<PersonRow, "activeGrants"> & {
  isVerifiedLibrarian: boolean
  acceptedCount: number
  grants: GrantRow[]
  openApplications: {
    documentId: string
    status: string
    summary: string
    createdAt: string | null
  }[]
  locales: string[]
}

/** Every role a grant can carry, in rank order. */
export const GRANT_ROLES = [
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "journal_editor",
  "moderator",
  "editorial_board",
] as const

export const ROLE_LABELS: Record<string, string> = {
  reader: "Reader",
  contributor: "Contributor",
  verified_librarian: "Verified librarian",
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
  moderator: "Moderator",
  editorial_board: "Editorial board",
}

export const QUEUE_LABELS: Record<string, string> = {
  all: "All queues",
  index: "Index",
  knowledge: "Knowledge",
  journal: "Journal",
  applications: "Applications",
}

export const SOURCE_LABELS: Record<string, string> = {
  admin: "Admin",
  claim: "Library claim",
  application: "Application",
  migration: "Migration",
}

/** Roles whose grant is scoped to a queue. */
export const usesQueue = (role: string) => role === "moderator"

/** Roles whose grant may be scoped to one language. */
export const usesLocale = (role: string) =>
  role === "moderator" || role === "wiki_editor" || role === "journal_editor"

export const GRANT_STATUS_META: Record<
  GrantStatus,
  { label: string; variant: "success" | "secondary" | "danger" }
> = {
  active: { label: "Active", variant: "success" },
  expired: { label: "Expired", variant: "secondary" },
  revoked: { label: "Revoked", variant: "danger" },
}

export const REASON_MAX = 500

/** The API's error message, or a fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? fallback
  )
}

export function nameOf(p: {
  displayName: string | null
  username: string | null
  baUserId: string
}): string {
  return p.displayName ?? (p.username ? `@${p.username}` : p.baUserId)
}

/** Where the plugin's pages live, under the admin's base path. */
export const PLUGIN_PATH = "/plugins/content-moderation"
export const PEOPLE_PATH = `${PLUGIN_PATH}/people`
export const APPLICATIONS_QUEUE_PATH = `${PLUGIN_PATH}?type=role_application`
