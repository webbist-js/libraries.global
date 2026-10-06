import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyEventFeed(req, {
    method: "PUT",
    path: `feeds/${documentId}/values`,
    kind: "write",
  })
}
