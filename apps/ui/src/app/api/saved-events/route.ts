import { savedEventsBridgeHeaders, STRAPI } from "@/lib/saved-events-bridge"

export async function GET() {
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return Response.json([], { status: 200 })

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    headers: bridge,
    cache: "no-store",
  })
  if (!res.ok) return Response.json([], { status: 200 })

  return Response.json(await res.json())
}

export async function POST(req: Request) {
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return new Response("Unauthorized", { status: 401 })

  let eventDocumentId: unknown
  try {
    ;({ eventDocumentId } = (await req.json()) as { eventDocumentId?: unknown })
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }
  if (typeof eventDocumentId !== "string" || !eventDocumentId)
    return new Response("eventDocumentId required", { status: 400 })

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    method: "POST",
    headers: { ...bridge, "Content-Type": "application/json" },
    body: JSON.stringify({ eventDocumentId }),
  })

  return Response.json(await res.json().catch(() => ({})), {
    status: res.status,
  })
}
