import { isDocumentIdParam } from "@/lib/bridge-params"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { savedEventsBridgeHeaders, STRAPI } from "@/lib/saved-events-bridge"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  if (!isDocumentIdParam(id))
    return Response.json({ error: "Invalid event ID" }, { status: 400 })
  const res = await fetch(
    `${STRAPI}/api/saved-events/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: bridge }
  )

  return new Response(null, { status: res.ok ? 204 : res.status })
}
