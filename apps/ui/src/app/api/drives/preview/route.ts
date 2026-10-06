import { previewDrive } from "@/lib/drives/drive-board-server"

/**
 * POST /api/drives/preview — the builder's live counts. Body
 * `{ scope, focus }` → `{ total, todo }` (plus `unknown` for pasted slugs
 * that weren't found), counted in Meilisearch as if the drive opened now.
 * Needs `drives.manage`, `submit.driveProposal` or `moderate.queue`.
 */
export async function POST(req: Request) {
  return previewDrive(req)
}
