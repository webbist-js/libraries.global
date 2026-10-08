import type { Capabilities, SubmissionType } from "./capabilities"

export type StaffRole = "owner" | "editor"
export const STAFF_ROLES: readonly StaffRole[] = ["owner", "editor"]
export type StaffAction =
  | "edit"
  | "reviewSuggestions"
  | "notices"
  | "seeTeam"
  | "manageTeam"
  | "manageLive"
  | "goLive"
export interface StaffClaim {
  libraryDocumentId: string
  staffRole: StaffRole
  canGoLive: boolean
}
export interface StaffEntry {
  role: StaffRole
  canGoLive: boolean
}

export function canStaff(
  c: Capabilities,
  action: StaffAction,
  libraryDocumentId: string
): boolean {
  const member = c.staff.get(libraryDocumentId)
  if (!member || !c.set.has("staff.area")) return false
  switch (action) {
    case "manageTeam":
    case "manageLive":
      return member.role === "owner"
    case "goLive":
      return member.canGoLive
    case "edit":
    case "reviewSuggestions":
    case "notices":
    case "seeTeam":
      return true

    default:
      return false
  }
}

export function canStaffReview(
  c: Capabilities,
  s: {
    submissionType: SubmissionType
    submittedByUserId: string
    targetLibraryDocumentId: string | null
  },
  viewerBaUserId: string
): boolean {
  return (
    s.submissionType === "correction" &&
    s.submittedByUserId !== viewerBaUserId &&
    !!s.targetLibraryDocumentId &&
    canStaff(c, "reviewSuggestions", s.targetLibraryDocumentId)
  )
}

/** Parse untrusted session data without granting defaults to malformed rows. */
export function parseSessionStaff(
  value: unknown
): { id: string; role: StaffRole; canGoLive: boolean }[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const { id, role, canGoLive } = row as Record<string, unknown>

    return typeof id === "string" &&
      id.length > 0 &&
      (role === "owner" || role === "editor") &&
      typeof canGoLive === "boolean"
      ? [{ id, role, canGoLive }]
      : []
  })
}
