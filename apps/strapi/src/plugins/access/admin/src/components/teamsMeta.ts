/** Shapes and labels for the Teams and Plans pages. */

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
  seats: number
  used: number
  status: "active" | "lapsed"
  source: "admin" | "checkout"
  verifiedAt: string | null
  expiresAt: string | null
  libraries: TeamLibrary[]
  createdAt: string | null
}

export type Team = TeamSummary & {
  publicServiceApproved?: boolean
  billingSuspended?: boolean
  notes: string | null
  members: TeamMember[]
  organiserNames: string[]
}

export type PlanGrant = {
  documentId: string
  baUserId: string
  name: string | null
  plan: string
  source: string | null
  reason: string | null
  grantedBy: string | null
  expiresAt: string | null
  createdAt: string | null
  status: "active" | "expired" | "revoked"
}

export type Verification = {
  documentId: string
  baUserId: string
  name: string | null
  kind: string
  verifiedEmail: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string | null
  status: "active" | "expired" | "revoked"
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
}

export const TEAM_ROLE_LABELS: Record<string, string> = {
  organiser: "Organiser",
  member: "Member",
}

export const PLAN_LABELS: Record<string, string> = {
  supporter: "Supporter",
  pro: "Pro",
  team: "Team",
}

export const GRANT_SOURCE_LABELS: Record<string, string> = {
  admin: "Admin",
  press: "Press",
  partner: "Partner",
  team: "Team",
  grant_funder: "Grant funder",
}

export const VERIFICATION_KIND_LABELS: Record<string, string> = {
  library_staff: "Library staff",
  student: "Student",
  charity: "Charity",
}

export const ROW_STATUS_META: Record<
  "active" | "expired" | "revoked",
  { label: string; variant: "success" | "secondary" | "danger" }
> = {
  active: { label: "Active", variant: "success" },
  expired: { label: "Expired", variant: "secondary" },
  revoked: { label: "Revoked", variant: "danger" },
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
