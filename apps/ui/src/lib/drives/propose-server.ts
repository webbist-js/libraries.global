import "server-only"

import {
  fetchMySubmissions,
  fetchSubmissionCounts,
} from "@/lib/role-application-server"

import { plainDriveTitle } from "./drive-view"

/** A proposal still waiting on a Moderator. */
const IN_REVIEW: ReadonlySet<string> = new Set(["pending", "needs_info"])

/** A proposal's drive title, without its `*italic*` markup; "" when it has none. */
function proposalTitle(draftData: unknown): string {
  const drive = (draftData as { drive?: { title?: unknown } } | null)?.drive
  const title = drive?.title

  return typeof title === "string" ? plainDriveTitle(title).trim() : ""
}

/**
 * What the propose page needs to know before it offers "Send proposal":
 * the user's accepted changes (Role Applications not counted) and their
 * proposal in review, if any. Both read 0 and null when the bridge is down;
 * Strapi's submission policy still decides on send.
 */
export async function proposalStanding(user: {
  id: string
  email: string
  name?: string | null
}): Promise<{
  accepted: number
  open: { documentId: string; title: string } | null
}> {
  const [counts, rows] = await Promise.all([
    fetchSubmissionCounts(user),
    fetchMySubmissions(user),
  ])
  const row = rows.find(
    (r) =>
      r.submissionType === "drive_proposal" &&
      IN_REVIEW.has(r.status ?? "") &&
      typeof r.documentId === "string"
  )

  return {
    accepted: counts.accepted,
    open: row
      ? {
          documentId: row.documentId as string,
          title: proposalTitle(row.draftData),
        }
      : null,
  }
}
