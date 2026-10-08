import { proxyStaff } from "@/lib/staff-proxy"

/** The staff drawer's summary for one library (`StaffDrawerData`). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyStaff(req, {
    base: "library-staff",
    path: `libraries/${documentId}/drawer`,
    libraryDocumentId: documentId,
    action: "seeTeam",
    method: "GET",
    limiter: "read",
    bodyKeys: [],
  })
}
