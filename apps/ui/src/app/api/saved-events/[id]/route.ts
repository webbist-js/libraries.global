import { savedEventsBridgeHeaders, STRAPI } from "@/lib/saved-events-bridge"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const res = await fetch(
    `${STRAPI}/api/saved-events/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: bridge }
  )

  return new Response(null, { status: res.ok ? 204 : res.status })
}
