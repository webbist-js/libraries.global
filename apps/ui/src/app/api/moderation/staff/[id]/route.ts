import { proxyModeration } from "@/lib/moderation-proxy"

// GET /api/moderation/staff/[id]  (id = the library)
// Who has staff access at one library, for a Moderator reviewing an access
// report: `{ library: { documentId, name, path }, staff: [{
// affiliationDocumentId, name, staffRole, source, approvedAt, canRemove }] }`.
// Strapi re-checks the `index` (or every-queue) scope and answers 404 for
// an unknown library.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  return proxyModeration(req, {
    path: `staff/${encodeURIComponent(id)}`,
    ids: [id],
  })
}
