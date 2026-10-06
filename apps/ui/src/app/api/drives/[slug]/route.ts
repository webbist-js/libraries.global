import { proxyBoardWrite } from "@/lib/drives/drive-board-server"

/**
 * PUT /api/drives/[documentId] — the editorial board edits a drive. Once
 * it has opened, Strapi takes only the title, summary, steps and where to
 * look. The segment is named `[slug]` because the drive's other routes
 * (`mine`, `tasks`) share this folder and Next allows one name per level;
 * here it holds the drive's documentId.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: documentId } = await params

  return proxyBoardWrite(req, { kind: "update", documentId })
}
