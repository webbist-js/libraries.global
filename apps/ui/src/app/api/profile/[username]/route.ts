import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const res = await fetch(
    `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } }
  )
  if (res.status === 404)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!res.ok)
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  const json = await res.json()

  return NextResponse.json(json)
}
