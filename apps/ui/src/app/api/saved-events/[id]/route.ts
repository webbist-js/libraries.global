import { headers } from "next/headers"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })

  return (session?.session as { strapiJWT?: string })?.strapiJWT ?? null
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  await fetch(`${STRAPI}/api/saved-events/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  })

  return new Response(null, { status: 204 })
}
