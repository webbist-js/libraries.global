import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")?.trim().toLowerCase()
  if (!username || username.length < 3)
    return NextResponse.json({ available: false, reason: "too_short" })
  if (!/^[a-z0-9_]+$/.test(username))
    return NextResponse.json({ available: false, reason: "invalid_chars" })

  const res = await fetch(
    `${STRAPI}/api/user-profiles?filters[username][$eq]=${encodeURIComponent(username)}&fields[0]=id`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return NextResponse.json({ available: false, reason: "error" })
  const json = (await res.json()) as { data: unknown[] }

  return NextResponse.json({ available: json.data.length === 0 })
}
