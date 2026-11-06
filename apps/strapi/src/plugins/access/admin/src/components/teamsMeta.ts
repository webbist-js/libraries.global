/** Shapes and labels for the Teams page. */

export type TeamLibrary = {
  documentId: string
  name: string
  slug: string
  libraryType: string
}

export type TeamAssignment = {
  affiliationDocumentId: string
  libraryDocumentId: string
  staffRole: "owner" | "editor"
  canGoLive: boolean
}

export type PendingAssignment = {
  submissionDocumentId: string
  libraryDocumentId: string
  staffRole: "owner" | "editor"
  status: string
}

export type TeamMember = {
  documentId: string
  baUserId: string | null
  name: string | null
  email: string
  emailMasked: string
  teamRole: "organiser" | "member"
  status: "invited" | "active"
  invitedAt: string | null
  acceptedAt: string | null
  preassign: { libraryDocumentId: string; staffRole: "owner" | "editor" } | null
  assignments: TeamAssignment[]
  pending: PendingAssignment[]
  isYou: boolean
}

export type TeamSummary = {
  documentId: string
  name: string
  slug: string
  status: "active" | "lapsed"
  source: "admin" | "checkout"
  verifiedAt: string | null
  expiresAt: string | null
  libraries: TeamLibrary[]
  createdAt: string | null
}

export type Team = TeamSummary & {
  widgetBranding?: boolean
  publicServiceApproved?: boolean
  notes: string | null
  members: TeamMember[]
  organiserNames: string[]
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
}

export const TEAM_ROLE_LABELS: Record<string, string> = {
  organiser: "Organiser",
  member: "Member",
}

/** A date for a table cell, or an em dash. */
export function dateCell(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
}

/** The API's error message, or a fallback. */
export function apiError(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? fallback
  )
}

export const memberLabel = (m: TeamMember): string =>
  m.name ?? m.email ?? m.emailMasked
