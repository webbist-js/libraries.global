import { proxyStaff } from "@/lib/staff-proxy"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ documentId: string; affiliationId: string }> }
) {
  const { documentId, affiliationId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/members/${encodeURIComponent(affiliationId)}`,
    libraryDocumentId: documentId,
    action: "manageTeam",
    method: "PUT",
    limiter: "write",
    bodyKeys: ["staffRole", "canGoLive"],
    entitlement: "library.team",
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ documentId: string; affiliationId: string }> }
) {
  const { documentId, affiliationId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/members/${encodeURIComponent(affiliationId)}`,
    libraryDocumentId: documentId,
    action: "manageTeam",
    method: "DELETE",
    limiter: "write",
    bodyKeys: [],
    entitlement: "library.team",
  })
}
