import { proposeDrive } from "@/lib/drives/drive-board-server"

/**
 * POST /api/drives/proposals — a contributor's Drive Proposal. Body: the
 * drive as the builder sends it, plus an optional `note` for the Moderator.
 * Needs `submit.driveProposal`; Strapi's submission policy decides the rest
 * and its answer comes back as it is.
 */
export async function POST(req: Request) {
  return proposeDrive(req)
}
