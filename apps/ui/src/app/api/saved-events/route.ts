import { headers } from "next/headers"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })

  return (session?.session as { strapiJWT?: string })?.strapiJWT ?? null
}

export async function GET() {
  const jwt = await getStrapiJwt()
  if (!jwt) return Response.json([], { status: 200 })

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const data = await res.json()

  return Response.json(data)
}

export async function POST(req: Request) {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response("Unauthorized", { status: 401 })

  const body = (await req.json()) as { eventDocumentId: string }
  const res = await fetch(`${STRAPI}/api/saved-events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  return Response.json(data, { status: res.status })
}
