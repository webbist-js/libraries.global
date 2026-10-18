import { proposedDrive } from "@repo/shared-data"

import { ApplyRefusedError } from "./publish-guard"
import { discussionActor } from "../../../../utils/discussions-host"
import {
  configureDriveDiscussions,
  validateDriveConversationRequest,
} from "../../../../utils/drive-discussions"

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

  const requested = submission?.draftData?.drive?.discussions
  if (requested !== undefined) {
    try {
      validateDriveConversationRequest(requested, false)
      const actor = await discussionActor(
        strapi,
        String(submission.submittedByUserId)
      )
      if (!actor) throw new Error("Discussion participant unavailable")
      const discussions = strapi.plugin("discussions").service("discussion")
      for (const threadId of requested.threadIds) {
        const thread = await discussions.getThread(actor, threadId)
        if (thread.state !== "visible")
          throw new Error("Discussion unavailable")
      }
      // An approved, immutable Drive proposal authorizes these context links;
      // verify the proposer's current read access before the trusted apply.
      await configureDriveDiscussions(
        strapi,
        String(submission.submittedByUserId),
        String(result.data.documentId),
        String(result.data.locale ?? "en"),
        { ...requested, baseVersion: 0 },
        {
          key: "system:approved-drive",
          name: "Approved Drive proposal",
          admin: true,
        }
      )
    } catch {
      throw new ApplyRefusedError("invalid_drive", DRIVE, documentId)
    }
  }

  return String(result.data.documentId)
}
