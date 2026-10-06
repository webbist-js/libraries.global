import { proxyBoardWrite } from "@/lib/drives/drive-board-server"

/**
 * POST /api/drives/[documentId]/actions — the editorial board pins,
 * features, opens, closes or cancels a drive. Body: `{ action, pinOrder? }`.
 * The segment holds the drive's documentId (see `../route.ts`).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: documentId } = await params

  return proxyBoardWrite(req, { kind: "action", documentId })
}
