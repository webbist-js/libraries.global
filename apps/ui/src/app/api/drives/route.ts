import { proxyBoardWrite } from "@/lib/drives/drive-board-server"

/**
 * POST /api/drives — the editorial board creates a drive (Strapi saves it
 * as `scheduled`). Needs `drives.manage`; Strapi re-checks the caller's
 * Role Grants. Body: the `DriveInput` keys only.
 */
export async function POST(req: Request) {
  return proxyBoardWrite(req, { kind: "create" })
}
