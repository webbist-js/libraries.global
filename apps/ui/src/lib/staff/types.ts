import type { StaffRole } from "@repo/access"

export type HealthRow = {
  key: string
  label: string
  note: string
  status: "ok" | "todo"
  action?: { label: string; href: string }
}
export type TeamMember = {
  affiliationDocumentId: string
  name: string
  initials: string
  staffRole?: StaffRole
  canGoLive?: boolean
  approvedAt?: string
  isYou: boolean
}
/** A Team invite pre-assigned to this library, waiting to be accepted. */
export type TeamInvite = {
  documentId: string
  emailMasked: string
  staffRole: StaffRole
  status: "pending" | "expired"
  expiresAt: string
}
/** The Team covering a library, for a viewer who belongs to it. */
export type LibraryTeam = {
  documentId: string
  name: string
  verified: boolean
  viewerIsOrganiser: boolean
  organiserNames: string[]
}
export type AuditRow = {
  at: string
  actorName: string
  action: string
  subjectName: string | null
}
export type StaffOverview = {
  library: {
    documentId: string
    name: string
    slug: string
    libraryType: string
    path: string
    /** Stored record completeness; older summaries may omit it. */
    completeness?: number | null
  }
  role: StaffRole
  health: HealthRow[]
  counts: {
    suggestions: number
    noticesUpcoming: number
    /** Notices showing now, measured in the library's timezone. */
    noticesActive?: number
  }
}
/**
 * The active Team covering a library that the viewer is *not* a member
 * of: enough to say "Ask {organiser} to add you" instead of a plan gate.
 */
export type CoveringTeam = {
  id: string
  name: string
  organiserName: string | null
  organiserEmailMasked: string | null
  viewerIsMember: false
}
export type StaffTeam = {
  members: TeamMember[]
  invites: TeamInvite[]
  audit: AuditRow[]
  canLeave: boolean
  /** True when an active Team of the viewer's covers this library. */
  covered: boolean
  /** The viewer's own Team covering this library, else null. */
  team: LibraryTeam | null
  /** A Team covering this library that the viewer isn't in, else null. */
  coveringTeam?: CoveringTeam | null
}

export type TeamRole = "organiser" | "member"

export type TeamAssignment = {
  affiliationDocumentId: string
  libraryDocumentId: string
  staffRole: StaffRole
  canGoLive: boolean
}

export type TeamPendingAssignment = {
  submissionDocumentId: string
  libraryDocumentId: string
  staffRole: StaffRole
  status: string
}

export type TeamMemberRow = {
  documentId: string
  baUserId: string | null
  name: string | null
  email: string
  emailMasked: string
  teamRole: TeamRole
  status: "invited" | "active"
  invitedAt: string | null
  acceptedAt: string | null
  preassign: { libraryDocumentId: string; staffRole: StaffRole } | null
  assignments: TeamAssignment[]
  pending: TeamPendingAssignment[]
  isYou: boolean
}

export type TeamLibrary = {
  documentId: string
  name: string
  slug: string
  libraryType: string
}

/** `GET /api/staff/team/[teamId]`: the organiser's (or a member's) view. */
export type TeamDetail = {
  documentId: string
  name: string
  slug: string
  seats: number
  used: number
  status: "active" | "lapsed"
  verifiedAt: string | null
  expiresAt: string | null
  libraries: TeamLibrary[]
  members: TeamMemberRow[]
  viewerRole: TeamRole | null
  organiserNames: string[]
}

/** `GET /api/staff/team`: the viewer's Teams. */
export type TeamSummary = {
  id: string
  name: string
  slug: string
  role: TeamRole
  libraryCount: number
  status: "active" | "lapsed"
  expiresAt: string | null
  verified: boolean
  organiserName: string | null
  libraryDocumentIds: string[]
}

/** `GET /api/staff/team/join/[token]`. */
export type TeamInvitePreview = {
  teamName: string
  teamRole: TeamRole
  invitedByName: string
  emailMasked: string
  emailMatches: boolean
  status: "open" | "expired" | "team_inactive"
  preassign: {
    libraryDocumentId: string
    staffRole: StaffRole
    libraryName?: string | null
    librarySlug?: string | null
  } | null
}
