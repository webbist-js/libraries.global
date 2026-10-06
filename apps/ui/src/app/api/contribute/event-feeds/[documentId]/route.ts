import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyEventFeed(req, {
    method: "DELETE",
    path: `feeds/${documentId}`,
    kind: "write",
  })
}
