import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { STRAPI } from "@/lib/saved-events-bridge"

/** DELETE /api/saved-views/:id: removes one of the account's saved items. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const secret = process.env.STRAPI_BRIDGE_SECRET
  const session = await auth.api.getSession({ headers: await headers() })
  if (!secret || !session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  if (!isDocumentIdParam(id))
    return Response.json({ error: "Not found" }, { status: 404 })

  const res = await fetch(
    `${STRAPI}/api/saved-views/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { "X-Service-Secret": secret, "X-Ba-User-Id": session.user.id },
    }
  ).catch(() => null)
  if (!res)
    return Response.json({ error: "Saved views unavailable" }, { status: 503 })

  return new Response(null, { status: res.status === 204 ? 204 : res.status })
}
