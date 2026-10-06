import { proposedDrive } from "@repo/shared-data"

import { ApplyRefusedError } from "./publish-guard"

const DRIVE = "api::drive.drive"

/**
 * Applies an approved Drive Proposal (ADR-0005: approval only schedules a
 * drive). Creates the drive the proposal asks for, with the Moderator's
 * dates when they changed them, as `scheduled`; the row records the
 * proposal it came from and is never pinned. Runs inside the approval's
 * transaction, so a throw rolls the approval back.
 *
 * Throws `ApplyRefusedError("invalid_drive")` when the proposal doesn't make
 * a valid drive as it stands: the Moderator changes its dates or rejects
 * it. Returns the new drive's documentId.
 */
export async function applyDriveProposal(
  strapi: any,
  submission: any
): Promise<string> {
  const documentId = String(submission?.documentId ?? "")
  const input = proposedDrive(submission?.draftData, {
    withModeratorEdit: true,
  })
  if (!input) throw new ApplyRefusedError("invalid_drive", DRIVE, documentId)

  const result = await strapi
    .service(DRIVE)
    .createDrive(input, String(submission.submittedByUserId), {
      proposalSubmissionDocumentId: documentId,
    })
  if (!result || "errors" in result) {
    const errors: unknown[] = Array.isArray(result?.errors) ? result.errors : []
    strapi.log.warn(
      `[content-moderation] drive_proposal ${documentId} isn't a valid drive as it stands: ${errors.join(" ") || "no drive created"}`
    )
    throw new ApplyRefusedError("invalid_drive", DRIVE, documentId)
  }

  return String(result.data.documentId)
}
