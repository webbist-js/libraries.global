const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_API_KEY // write-capable token

export async function POST(req: Request) {
  const body = (await req.json()) as {
    libraryEntityRef: string
    providerType: string
    feedUrl?: string
    notes?: string
    submittedByName: string
    submittedByEmail: string
  }

  if (!body.libraryEntityRef || !body.providerType || !body.submittedByEmail) {
    return new Response("Missing required fields", { status: 400 })
  }

  const res = await fetch(`${STRAPI}/api/event-providers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      data: {
        ...body,
        status: "pending",
      },
    }),
  })

  if (!res.ok) return new Response("Strapi error", { status: 500 })

  return new Response(null, { status: 201 })
}
