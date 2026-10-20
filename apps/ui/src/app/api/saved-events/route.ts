import { z } from "zod"

import { isDocumentIdParam } from "@/lib/bridge-params"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { savedEventsBridgeHeaders, STRAPI } from "@/lib/saved-events-bridge"
import { readTypedJson } from "@/lib/typed-json"

export async function GET() {
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    headers: bridge,
    cache: "no-store",
  }).catch(() => null)
  if (!res?.ok)
    return Response.json({ error: "Saved events unavailable" }, { status: 503 })

  return Response.json(await res.json())
}

export async function POST(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return new Response("Unauthorized", { status: 401 })

  const parsed = await readTypedJson(
    req,
    4096,
    z.object({ eventDocumentId: z.string().refine(isDocumentIdParam) }).strict()
  )
  if (!parsed.ok)
    return Response.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const { eventDocumentId } = parsed.body

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    method: "POST",
    headers: { ...bridge, "Content-Type": "application/json" },
    body: JSON.stringify({ eventDocumentId }),
  })

  return Response.json(await res.json().catch(() => ({})), {
    status: res.status,
  })
}
