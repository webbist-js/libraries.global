import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyEventFeed(req, {
    method: "POST",
    path: `feeds/${documentId}/organization`,
    kind: "write",
  })
}
