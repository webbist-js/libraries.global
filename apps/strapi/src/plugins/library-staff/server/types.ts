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
  staffRole: StaffRole
  canGoLive: boolean
  approvedAt: string
  isYou: boolean
}
export type TeamInvite = {
  documentId: string
  emailMasked: string
  staffRole: StaffRole
  status: "pending" | "claimed" | "accepted" | "revoked" | "expired"
  expiresAt: string
}
export type AuditRow = {
  at: string
  actorName: string
  action: string
  subjectName: string | null
}
